-- Optional announcements and device subscriptions, independent of guest Auth.
create table public.game_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 80),
  message text not null check (length(message) between 1 and 240),
  path text not null default '/?updates=1' check (length(path) <= 300 and path like '/%' and path not like '//%'),
  published boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  check (expires_at > publish_at and expires_at <= publish_at + interval '30 days')
);
create table public.game_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (length(endpoint) <= 2048),
  keys jsonb not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  origin text not null check (length(origin) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_push_token_idx on public.game_push_subscriptions(token_hash, origin);
create index game_announcements_live_idx on public.game_announcements(publish_at) where published;
create table public.game_push_deliveries (
  announcement_id uuid not null references public.game_announcements on delete cascade,
  subscription_id uuid not null references public.game_push_subscriptions on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed','expired')),
  attempts integer not null default 0,
  lease uuid,
  attempted_at timestamptz,
  status integer,
  primary key (announcement_id, subscription_id)
);
create index game_push_pending_idx on public.game_push_deliveries(state, attempted_at);
alter table public.game_announcements enable row level security;
alter table public.game_push_subscriptions enable row level security;
alter table public.game_push_deliveries enable row level security;
revoke all on public.game_announcements, public.game_push_subscriptions, public.game_push_deliveries from public, anon, authenticated;
grant all on public.game_announcements, public.game_push_subscriptions, public.game_push_deliveries to service_role;

create function public.game_push_subscribe(p_endpoint text, p_keys jsonb, p_token_hash text, p_origin text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.game_push_subscriptions(endpoint,keys,token_hash,origin)
    values(p_endpoint,p_keys,p_token_hash,p_origin)
    on conflict(endpoint) do update set keys=excluded.keys, updated_at=now()
    where public.game_push_subscriptions.token_hash=excluded.token_hash
      and public.game_push_subscriptions.origin=excluded.origin;
  if not found then raise exception 'subscription_owned'; end if;
  return true;
end;
$$;
create function public.game_push_enqueue()
returns void language sql security invoker set search_path = '' as $$
  insert into public.game_push_deliveries(announcement_id,subscription_id)
  select a.id,s.id from public.game_announcements a cross join public.game_push_subscriptions s
  where a.published and a.publish_at <= now() and a.expires_at > now() and s.created_at <= a.publish_at
  on conflict do nothing;
$$;
create function public.game_push_claim(p_limit integer default 10)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  with candidates as (
    select d.announcement_id,d.subscription_id from public.game_push_deliveries d
    join public.game_announcements a on a.id=d.announcement_id
    where a.published and a.publish_at <= now() and a.expires_at > now() and d.attempts < 3
      and (d.state='pending' or (d.state in ('sending','failed') and d.attempted_at < now()-interval '15 minutes'))
    order by a.publish_at,d.subscription_id limit least(greatest(p_limit,1),50) for update of d skip locked
  ), claimed as (
    update public.game_push_deliveries d set state='sending', attempts=attempts+1,lease=gen_random_uuid(),attempted_at=now()
    from candidates c where d.announcement_id=c.announcement_id and d.subscription_id=c.subscription_id
    returning d.*
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'announcement_id',d.announcement_id,'subscription_id',d.subscription_id,'lease',d.lease,
    'endpoint',s.endpoint,'keys',s.keys,'title',a.title,'message',a.message,'path',a.path,'expires_at',a.expires_at
  )),'[]'::jsonb) into result from claimed d
    join public.game_push_subscriptions s on s.id=d.subscription_id
    join public.game_announcements a on a.id=d.announcement_id;
  return result;
end;
$$;
create function public.game_push_finish(p_announcement uuid,p_subscription uuid,p_lease uuid,p_state text,p_status integer)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_state not in ('sent','failed','expired') then raise exception 'invalid_delivery_state'; end if;
  update public.game_push_deliveries set state=p_state,status=p_status
    where announcement_id=p_announcement and subscription_id=p_subscription and lease=p_lease and state='sending';
  if found and p_state='expired' and p_status in (404,410) then
    delete from public.game_push_subscriptions where id=p_subscription;
  end if;
end;
$$;
revoke all on function public.game_push_subscribe(text,jsonb,text,text), public.game_push_enqueue(), public.game_push_claim(integer), public.game_push_finish(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.game_push_subscribe(text,jsonb,text,text), public.game_push_enqueue(), public.game_push_claim(integer), public.game_push_finish(uuid,uuid,uuid,text,integer) to service_role;
