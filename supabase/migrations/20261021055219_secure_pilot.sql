-- Secure pilot schema. Apply through the versioned migration, not the legacy seed.
-- Fresh pilot tables deliberately do not import legacy identities or scores.
DO $$ DECLARE t text; policy_name text; BEGIN
  FOREACH t IN ARRAY ARRAY['players','tournaments','tournament_scores','player_progress','referrals'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY %I ON public.%I',policy_name,t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

CREATE TABLE public.pilot_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname varchar(24) NOT NULL CHECK (length(trim(nickname)) BETWEEN 1 AND 24),
  adult_attested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pilot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cup_id text NOT NULL,
  title text NOT NULL, prize_pool text NOT NULL, prize_tiers jsonb NOT NULL DEFAULT '[]',
  prize_slots integer NOT NULL DEFAULT 3 CHECK (prize_slots BETWEEN 1 AND 20),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','open','closed')),
  is_demo boolean NOT NULL DEFAULT true,
  CHECK (ends_at > starts_at), UNIQUE(cup_id, starts_at)
);
CREATE TABLE public.pilot_wallets (
  user_id uuid NOT NULL REFERENCES public.pilot_profiles(user_id) ON DELETE CASCADE,
  day date NOT NULL, base_used integer NOT NULL DEFAULT 0 CHECK (base_used BETWEEN 0 AND 3),
  bonus_earned integer NOT NULL DEFAULT 0 CHECK (bonus_earned BETWEEN 0 AND 2),
  bonus_used integer NOT NULL DEFAULT 0 CHECK (bonus_used BETWEEN 0 AND bonus_earned),
  PRIMARY KEY(user_id,day)
);
CREATE TABLE public.pilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.pilot_profiles(user_id) ON DELETE CASCADE,
  request_id uuid NOT NULL, event_id uuid REFERENCES public.pilot_events(id),
  kind text NOT NULL CHECK (kind IN ('tournament','levels')),
  level integer CHECK (level BETWEEN 1 AND 60), seed bigint NOT NULL CHECK(seed BETWEEN 0 AND 4294967295),
  engine_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK(status IN ('started','accepted')),
  result jsonb, actions jsonb, replay_hash text, accepted_at timestamptz,
  CHECK ((kind='tournament' AND event_id IS NOT NULL AND level IS NULL) OR (kind='levels' AND event_id IS NULL AND level IS NOT NULL)),
  UNIQUE(user_id,request_id)
);
CREATE INDEX pilot_runs_standings ON public.pilot_runs(event_id,status,accepted_at,id);
CREATE INDEX pilot_runs_user ON public.pilot_runs(user_id,status);
CREATE TABLE public.pilot_progress (
  user_id uuid NOT NULL REFERENCES public.pilot_profiles(user_id) ON DELETE CASCADE,
  level integer NOT NULL CHECK(level BETWEEN 1 AND 60),
  stars integer NOT NULL CHECK(stars BETWEEN 1 AND 3), best_score integer NOT NULL CHECK(best_score>=0),
  PRIMARY KEY(user_id,level)
);
CREATE TABLE public.pilot_referrals (
  referred_id uuid PRIMARY KEY REFERENCES public.pilot_profiles(user_id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.pilot_profiles(user_id) ON DELETE CASCADE,
  attributed_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, credited boolean NOT NULL DEFAULT false,
  CHECK(referred_id<>referrer_id)
);
CREATE TABLE public.pilot_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.pilot_events(id),
  user_id uuid NOT NULL REFERENCES public.pilot_profiles(user_id), code_hash text NOT NULL,
  code_expires_at timestamptz NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  phone text CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'), full_name text,
  reviewed_at timestamptz, review_reason text, adult_reviewed boolean NOT NULL DEFAULT false,
  result_reviewed boolean NOT NULL DEFAULT false,
  UNIQUE(event_id,user_id)
);
CREATE UNIQUE INDEX pilot_claim_phone_once ON public.pilot_claims(event_id,phone) WHERE status='approved';
CREATE TABLE public.pilot_rate_limits (
  key text NOT NULL, window_start timestamptz NOT NULL, count integer NOT NULL,
  PRIMARY KEY(key,window_start)
);

-- No direct client mutations. Authenticated includes guest users: ownership is mandatory.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['pilot_profiles','pilot_events','pilot_wallets','pilot_runs','pilot_progress','pilot_referrals','pilot_claims','pilot_rate_limits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;
GRANT SELECT ON public.pilot_profiles, public.pilot_wallets, public.pilot_progress TO authenticated;
CREATE POLICY pilot_profile_owner ON public.pilot_profiles FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY pilot_wallet_owner ON public.pilot_wallets FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY pilot_progress_owner ON public.pilot_progress FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
-- Claims include private contact details and remain accessible only through the API/owner projection.

CREATE FUNCTION public.pilot_rate_limit(p_key text,p_limit integer,p_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer; BEGIN
  INSERT INTO public.pilot_rate_limits(key,window_start,count)
  VALUES(p_key,to_timestamp(floor(extract(epoch FROM now())/p_seconds)*p_seconds),1)
  ON CONFLICT(key,window_start) DO UPDATE SET count=public.pilot_rate_limits.count+1 RETURNING count INTO n;
  RETURN n<=p_limit;
END $$;

CREATE FUNCTION public.pilot_profile(p_user uuid,p_nickname text,p_adult boolean) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  INSERT INTO public.pilot_profiles(user_id,nickname,adult_attested) VALUES(p_user,trim(p_nickname),p_adult)
  ON CONFLICT(user_id) DO UPDATE SET nickname=EXCLUDED.nickname,adult_attested=public.pilot_profiles.adult_attested OR EXCLUDED.adult_attested;
$$;

CREATE FUNCTION public.pilot_start(p_user uuid,p_request uuid,p_event uuid,p_kind text,p_level integer,p_seed bigint,p_version text,p_nickname text,p_adult boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.pilot_runs; e public.pilot_events; w public.pilot_wallets; d date := (now() AT TIME ZONE 'Africa/Johannesburg')::date; expiry timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  SELECT * INTO r FROM public.pilot_runs WHERE user_id=p_user AND request_id=p_request;
  IF FOUND THEN
    IF r.kind<>p_kind OR r.event_id IS DISTINCT FROM p_event OR r.level IS DISTINCT FROM p_level THEN RAISE EXCEPTION 'request_conflict'; END IF;
    RETURN to_jsonb(r);
  END IF;
  IF p_kind NOT IN ('tournament','levels') OR p_version<>'pilot-1' THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF length(trim(p_nickname)) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'invalid_nickname'; END IF;
  INSERT INTO public.pilot_profiles(user_id,nickname,adult_attested) VALUES(p_user,trim(p_nickname),p_adult)
  ON CONFLICT(user_id) DO UPDATE SET nickname=EXCLUDED.nickname,adult_attested=public.pilot_profiles.adult_attested OR EXCLUDED.adult_attested;
  expiry := now()+interval '48 hours';
  IF p_kind='tournament' THEN
    IF NOT p_adult THEN RAISE EXCEPTION 'adult_required'; END IF;
    SELECT * INTO e FROM public.pilot_events WHERE id=p_event FOR SHARE;
    IF NOT FOUND OR e.state<>'open' OR now()<e.starts_at OR now()>=e.ends_at THEN RAISE EXCEPTION 'event_unavailable'; END IF;
    expiry := least(expiry,e.ends_at);
    INSERT INTO public.pilot_wallets(user_id,day) VALUES(p_user,d) ON CONFLICT DO NOTHING;
    SELECT * INTO w FROM public.pilot_wallets WHERE user_id=p_user AND day=d FOR UPDATE;
    IF w.base_used<3 THEN UPDATE public.pilot_wallets SET base_used=base_used+1 WHERE user_id=p_user AND day=d;
    ELSIF w.bonus_used<w.bonus_earned THEN UPDATE public.pilot_wallets SET bonus_used=bonus_used+1 WHERE user_id=p_user AND day=d;
    ELSE RAISE EXCEPTION 'tickets_exhausted'; END IF;
  ELSE
    IF p_event IS NOT NULL OR p_level IS NULL OR p_level NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'invalid_level'; END IF;
    IF p_level>1 AND NOT EXISTS(SELECT 1 FROM public.pilot_progress WHERE user_id=p_user AND level=p_level-1) THEN RAISE EXCEPTION 'level_locked'; END IF;
  END IF;
  INSERT INTO public.pilot_runs(user_id,request_id,event_id,kind,level,seed,engine_version,expires_at)
  VALUES(p_user,p_request,p_event,p_kind,p_level,p_seed,p_version,expiry) RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

CREATE FUNCTION public.pilot_standings(p_event uuid,p_user uuid DEFAULT NULL)
RETURNS TABLE(rank bigint,user_id uuid,nickname text,score integer,accepted_at timestamptz,run_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH best AS (
    SELECT DISTINCT ON(r.user_id) r.user_id,(r.result->>'score')::integer AS score,r.accepted_at,r.id
    FROM public.pilot_runs r WHERE r.event_id=p_event AND r.status='accepted'
    ORDER BY r.user_id,(r.result->>'score')::integer DESC,r.accepted_at,r.id
  )
  SELECT * FROM (
    SELECT row_number() OVER(ORDER BY b.score DESC,b.accepted_at,b.id) AS rank,b.user_id,p.nickname::text,b.score,b.accepted_at,b.id AS run_id
    FROM best b JOIN public.pilot_profiles p ON p.user_id=b.user_id
  ) ranked WHERE p_user IS NULL OR ranked.user_id=p_user ORDER BY rank;
$$;


CREATE FUNCTION public.pilot_board(p_event uuid,p_user uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH standings AS MATERIALIZED (SELECT * FROM public.pilot_standings(p_event)),
  stars AS MATERIALIZED (
    SELECT row_number() OVER(ORDER BY sum(g.stars) DESC,g.user_id) AS rank,g.user_id,p.nickname,sum(g.stars)::integer AS stars
    FROM public.pilot_progress g JOIN public.pilot_profiles p ON p.user_id=g.user_id GROUP BY g.user_id,p.nickname
  )
  SELECT jsonb_build_object(
    'tournament',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.rank) FROM (SELECT * FROM standings ORDER BY rank LIMIT 20) s),'[]'::jsonb),
    'me',(SELECT to_jsonb(s) FROM standings s WHERE s.user_id=p_user),
    'stars',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.rank) FROM (SELECT * FROM stars ORDER BY rank LIMIT 20) s),'[]'::jsonb),
    'myStars',coalesce((SELECT s.stars FROM stars s WHERE s.user_id=p_user),0),'maxStars',180
  );
$$;

CREATE FUNCTION public.pilot_accept(p_user uuid,p_run uuid,p_hash text,p_result jsonb,p_actions jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.pilot_runs; ref public.pilot_referrals; d date := (now() AT TIME ZONE 'Africa/Johannesburg')::date; credited_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  SELECT * INTO r FROM public.pilot_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF r.status='accepted' THEN
    IF r.replay_hash<>p_hash THEN RAISE EXCEPTION 'replay_conflict'; END IF;
    RETURN jsonb_build_object('scoreId',r.id,'score',(r.result->>'score')::integer,'stars',(r.result->>'stars')::integer,'acceptedAt',r.accepted_at,'duplicate',true);
  END IF;
  IF now()>=r.expires_at THEN RAISE EXCEPTION 'session_expired'; END IF;
  IF r.kind='tournament' THEN
    PERFORM 1 FROM public.pilot_events WHERE id=r.event_id AND state='open' AND starts_at<=now() AND ends_at>now() FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'event_unavailable'; END IF;
  END IF;
  IF (p_result->>'score')::integer<0 OR p_result->>'engineVersion'<>r.engine_version THEN RAISE EXCEPTION 'invalid_result'; END IF;
  IF r.kind='levels' THEN
    IF NOT coalesce((p_result->>'completed')::boolean,false) THEN RAISE EXCEPTION 'level_incomplete'; END IF;
    INSERT INTO public.pilot_progress(user_id,level,stars,best_score) VALUES(p_user,r.level,(p_result->>'stars')::integer,(p_result->>'score')::integer)
    ON CONFLICT(user_id,level) DO UPDATE SET stars=greatest(public.pilot_progress.stars,EXCLUDED.stars),best_score=greatest(public.pilot_progress.best_score,EXCLUDED.best_score);
  END IF;
  UPDATE public.pilot_runs SET status='accepted',result=p_result,actions=p_actions,replay_hash=p_hash,accepted_at=now() WHERE id=r.id RETURNING * INTO r;
  IF (p_result->>'score')::integer>=100 THEN
    SELECT * INTO ref FROM public.pilot_referrals WHERE referred_id=p_user FOR UPDATE;
    IF FOUND AND ref.completed_at IS NULL THEN
      INSERT INTO public.pilot_wallets(user_id,day,bonus_earned) VALUES(ref.referrer_id,d,1)
      ON CONFLICT(user_id,day) DO UPDATE SET bonus_earned=public.pilot_wallets.bonus_earned+1 WHERE public.pilot_wallets.bonus_earned<2
      RETURNING bonus_earned INTO credited_count;
      UPDATE public.pilot_referrals SET completed_at=now(),credited=(credited_count IS NOT NULL) WHERE referred_id=p_user;
    END IF;
  END IF;
  RETURN jsonb_build_object('scoreId',r.id,'score',(r.result->>'score')::integer,'stars',(r.result->>'stars')::integer,'acceptedAt',r.accepted_at,'duplicate',false);
END $$;

CREATE FUNCTION public.pilot_attribute_referral(p_user uuid,p_referrer uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  IF p_user=p_referrer OR NOT EXISTS(SELECT 1 FROM public.pilot_profiles WHERE user_id=p_referrer)
    OR EXISTS(SELECT 1 FROM public.pilot_runs WHERE user_id=p_user AND status='accepted') THEN RETURN false; END IF;
  INSERT INTO public.pilot_referrals(referred_id,referrer_id) VALUES(p_user,p_referrer) ON CONFLICT DO NOTHING;
  RETURN FOUND;
END $$;

CREATE FUNCTION public.pilot_create_claim(p_user uuid,p_event uuid,p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.pilot_events; c public.pilot_claims; place bigint; BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  SELECT * INTO e FROM public.pilot_events WHERE id=p_event;
  IF NOT FOUND OR e.is_demo OR e.state='draft' OR now()<e.ends_at OR now()>=e.ends_at+interval '48 hours' THEN RAISE EXCEPTION 'claim_window_closed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pilot_profiles WHERE user_id=p_user AND adult_attested) THEN RAISE EXCEPTION 'adult_required'; END IF;
  SELECT s.rank INTO place FROM public.pilot_standings(p_event) s WHERE s.user_id=p_user;
  IF place IS NULL OR place>e.prize_slots THEN RAISE EXCEPTION 'not_eligible'; END IF;
  SELECT * INTO c FROM public.pilot_claims WHERE event_id=p_event AND user_id=p_user FOR UPDATE;
  IF FOUND AND c.status<>'pending' THEN RAISE EXCEPTION 'claim_already_reviewed'; END IF;
  INSERT INTO public.pilot_claims(event_id,user_id,code_hash,code_expires_at)
  VALUES(p_event,p_user,p_hash,least(now()+interval '30 minutes',e.ends_at+interval '48 hours'))
  ON CONFLICT(event_id,user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,code_expires_at=EXCLUDED.code_expires_at
  RETURNING * INTO c;
  RETURN jsonb_build_object('claimId',c.id,'status',c.status,'expiresAt',c.code_expires_at);
END $$;

CREATE FUNCTION public.pilot_review_claim(p_claim uuid,p_hash text,p_phone text,p_name text,p_adult boolean,p_result_reviewed boolean,p_decision text,p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.pilot_claims; e public.pilot_events; place bigint; BEGIN
  SELECT * INTO c FROM public.pilot_claims WHERE id=p_claim FOR UPDATE;
  IF NOT FOUND OR c.status<>'pending' THEN RAISE EXCEPTION 'claim_unavailable'; END IF;
  IF c.code_hash<>p_hash OR now()>=c.code_expires_at THEN RAISE EXCEPTION 'claim_code_invalid'; END IF;
  SELECT * INTO e FROM public.pilot_events WHERE id=c.event_id FOR SHARE;
  IF e.is_demo OR e.state='draft' OR now()<e.ends_at OR now()>=e.ends_at+interval '48 hours' THEN RAISE EXCEPTION 'claim_window_closed'; END IF;
  SELECT s.rank INTO place FROM public.pilot_standings(c.event_id) s WHERE s.user_id=c.user_id;
  IF place IS NULL OR place>e.prize_slots THEN RAISE EXCEPTION 'not_eligible'; END IF;
  IF p_decision NOT IN ('approved','rejected') OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'review_reason_required'; END IF;
  IF p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'invalid_phone'; END IF;
  IF p_decision='approved' AND (NOT p_adult OR NOT p_result_reviewed OR length(trim(coalesce(p_name,'')))<2) THEN RAISE EXCEPTION 'review_required'; END IF;
  IF EXISTS(SELECT 1 FROM public.pilot_claims WHERE event_id=c.event_id AND phone=p_phone AND status='approved' AND id<>c.id) THEN RAISE EXCEPTION 'duplicate_phone_review'; END IF;
  UPDATE public.pilot_claims SET status=p_decision,phone=p_phone,full_name=p_name,reviewed_at=now(),review_reason=p_reason,
    adult_reviewed=p_adult,result_reviewed=p_result_reviewed WHERE id=c.id;
  RETURN p_decision;
END $$;

-- PostgreSQL grants function EXECUTE to PUBLIC by default: revoke each pilot RPC explicitly.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'pilot_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
