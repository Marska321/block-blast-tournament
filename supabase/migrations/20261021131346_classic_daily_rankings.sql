-- Ranked Classic is free, non-prize play, independent of pilot events/tickets.
CREATE TABLE public.classic_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname varchar(24) NOT NULL CHECK (length(trim(nickname)) BETWEEN 1 AND 24 AND nickname !~ '[<>[:cntrl:]]'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.classic_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.classic_profiles(user_id) ON DELETE CASCADE,
  request_id uuid NOT NULL, day date NOT NULL,
  seed bigint NOT NULL CHECK(seed BETWEEN 0 AND 4294967295), engine_version text NOT NULL,
  nickname varchar(24) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK(status IN ('started','accepted')),
  score bigint CHECK(score BETWEEN 0 AND 9007199254740991),
  moves integer CHECK(moves BETWEEN 1 AND 10000), revives integer CHECK(revives BETWEEN 0 AND 1),
  accepted_at timestamptz, replay_hash text, actions jsonb, receipt jsonb,
  UNIQUE(user_id,request_id),
  CHECK(day=(created_at AT TIME ZONE 'Africa/Johannesburg')::date),
  CHECK(expires_at=((day+1)::timestamp AT TIME ZONE 'Africa/Johannesburg'))
);
CREATE INDEX classic_runs_user ON public.classic_runs(user_id,day);
CREATE TABLE public.classic_daily_best (
  day date NOT NULL, user_id uuid NOT NULL REFERENCES public.classic_profiles(user_id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.classic_runs(id) ON DELETE CASCADE,
  nickname varchar(24) NOT NULL, score bigint NOT NULL CHECK(score BETWEEN 0 AND 9007199254740991),
  accepted_at timestamptz NOT NULL,
  PRIMARY KEY(day,user_id),
  CHECK(day=(accepted_at AT TIME ZONE 'Africa/Johannesburg')::date)
);
CREATE INDEX classic_best_ranking ON public.classic_daily_best(day,score DESC,accepted_at,run_id);
CREATE INDEX classic_best_streak ON public.classic_daily_best(user_id,day) WHERE score>=100;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['classic_profiles','classic_runs','classic_daily_best'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;

CREATE FUNCTION public.classic_streak(p_user uuid,p_today date DEFAULT (now() AT TIME ZONE 'Africa/Johannesburg')::date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH days AS (
    SELECT day, day-row_number() OVER(ORDER BY day)::integer AS island
    FROM public.classic_daily_best WHERE user_id=p_user AND score>=100 AND day<=p_today
  ), stretches AS (
    SELECT count(*)::integer AS length, max(day) AS last_day FROM days GROUP BY island
  ) SELECT jsonb_build_object(
    'current',COALESCE((SELECT max(length) FROM stretches WHERE last_day>=p_today-1),0),
    'longest',COALESCE((SELECT max(length) FROM stretches),0),
    'playedToday',EXISTS(SELECT 1 FROM days WHERE day=p_today));
$$;

CREATE FUNCTION public.classic_standings(p_day date,p_user uuid)
RETURNS TABLE(rank bigint,nickname text,score bigint,"isMe" boolean,"pointsToNext" bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT row_number() OVER w,b.nickname::text,b.score,COALESCE(b.user_id=p_user,false),
    lag(b.score) OVER w-b.score+1
  FROM public.classic_daily_best b WHERE b.day=p_day
  WINDOW w AS (ORDER BY b.score DESC,b.accepted_at,b.run_id);
$$;

CREATE FUNCTION public.classic_board(p_day date DEFAULT NULL,p_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  d date := COALESCE(p_day,today); result jsonb;
BEGIN
  IF d>today OR d<today-30 THEN RAISE EXCEPTION 'invalid_day'; END IF;
  SELECT jsonb_build_object('day',d,'today',today,
    'startsAt',d::timestamp AT TIME ZONE 'Africa/Johannesburg',
    'endsAt',(d+1)::timestamp AT TIME ZONE 'Africa/Johannesburg',
    'closed',d<today,'serverTime',now(),
    'participants',(SELECT count(*) FROM public.classic_daily_best WHERE day=d),
    'entries',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY rank) FROM
      (SELECT * FROM public.classic_standings(d,p_user) ORDER BY rank LIMIT 20) s),'[]'),
    'me',(SELECT to_jsonb(s) FROM public.classic_standings(d,p_user) s WHERE "isMe"),
    'streak',public.classic_streak(p_user,today)) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.classic_start(p_user uuid,p_request uuid,p_seed bigint,p_version text,p_nickname text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.classic_runs; d date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('classic:'||p_user::text,0));
  SELECT * INTO r FROM public.classic_runs WHERE user_id=p_user AND request_id=p_request;
  IF NOT FOUND THEN
    d := (clock_timestamp() AT TIME ZONE 'Africa/Johannesburg')::date;
    IF length(trim(p_nickname)) NOT BETWEEN 1 AND 24 OR p_nickname ~ '[<>[:cntrl:]]' THEN
      RAISE EXCEPTION 'invalid_nickname'; END IF;
    INSERT INTO public.classic_profiles(user_id,nickname) VALUES(p_user,trim(p_nickname))
      ON CONFLICT(user_id) DO UPDATE SET nickname=EXCLUDED.nickname;
    INSERT INTO public.classic_runs(user_id,request_id,day,seed,engine_version,nickname,expires_at)
      VALUES(p_user,p_request,d,p_seed,p_version,trim(p_nickname),(d+1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
      RETURNING * INTO r;
  END IF;
  RETURN jsonb_build_object('id',r.id,'user_id',r.user_id,'day',r.day,'seed',r.seed,
    'engine_version',r.engine_version,'expires_at',r.expires_at);
END $$;

CREATE FUNCTION public.classic_accept(p_user uuid,p_run uuid,p_hash text,p_actions jsonb,p_score bigint,p_moves integer,p_revives integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.classic_runs; accepted timestamptz; place bigint; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('classic:'||p_user::text,0));
  SELECT * INTO r FROM public.classic_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF r.status='accepted' THEN
    IF r.replay_hash<>p_hash THEN RAISE EXCEPTION 'replay_conflict'; END IF;
    RETURN r.receipt;
  END IF;
  accepted := clock_timestamp();
  IF accepted>=r.expires_at THEN RAISE EXCEPTION 'session_expired'; END IF;
  IF p_moves<1 OR p_revives NOT BETWEEN 0 AND 1 OR jsonb_typeof(p_actions)<>'array' THEN
    RAISE EXCEPTION 'invalid_session'; END IF;
  UPDATE public.classic_runs SET status='accepted',score=p_score,moves=p_moves,revives=p_revives,
    accepted_at=accepted,replay_hash=p_hash,actions=p_actions WHERE id=p_run;
  INSERT INTO public.classic_daily_best(day,user_id,run_id,nickname,score,accepted_at)
    VALUES(r.day,p_user,r.id,r.nickname,p_score,accepted)
    ON CONFLICT(day,user_id) DO UPDATE SET run_id=EXCLUDED.run_id,nickname=EXCLUDED.nickname,
      score=EXCLUDED.score,accepted_at=EXCLUDED.accepted_at
    WHERE EXCLUDED.score>public.classic_daily_best.score;
  SELECT rank INTO place FROM public.classic_standings(r.day,p_user) WHERE "isMe";
  result := jsonb_build_object('success',true,'scoreId',r.id,'score',p_score,'day',r.day,
    'acceptedAt',accepted,'rankAtAcceptance',place,'revives',p_revives,'streak',public.classic_streak(p_user));
  UPDATE public.classic_runs SET receipt=result WHERE id=p_run;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.classic_streak(uuid,date), public.classic_standings(date,uuid),
  public.classic_board(date,uuid), public.classic_start(uuid,uuid,bigint,text,text),
  public.classic_accept(uuid,uuid,text,jsonb,bigint,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classic_streak(uuid,date), public.classic_standings(date,uuid),
  public.classic_board(date,uuid), public.classic_start(uuid,uuid,bigint,text,text),
  public.classic_accept(uuid,uuid,text,jsonb,bigint,integer,integer) TO service_role;
