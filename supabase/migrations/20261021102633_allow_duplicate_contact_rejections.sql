-- Permit a recorded rejection when a sender already has an approved claim.
CREATE OR REPLACE FUNCTION public.pilot_review_claim(p_claim uuid,p_hash text,p_phone text,p_name text,p_adult boolean,p_result_reviewed boolean,p_decision text,p_reason text)
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
  IF p_decision='approved' AND EXISTS(SELECT 1 FROM public.pilot_claims WHERE event_id=c.event_id AND phone=p_phone AND status='approved' AND id<>c.id) THEN RAISE EXCEPTION 'duplicate_phone_review'; END IF;
  UPDATE public.pilot_claims SET status=p_decision,phone=p_phone,full_name=p_name,reviewed_at=now(),review_reason=p_reason,
    adult_reviewed=p_adult,result_reviewed=p_result_reviewed WHERE id=c.id;
  RETURN p_decision;
END $$;

REVOKE ALL ON FUNCTION public.pilot_review_claim(uuid,text,text,text,boolean,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_review_claim(uuid,text,text,text,boolean,boolean,text,text) TO service_role;
