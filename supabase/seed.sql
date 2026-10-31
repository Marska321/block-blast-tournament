-- Staging/local demo only. Never seed fake player scores or real prize promises.
INSERT INTO public.pilot_events(id,cup_id,title,prize_pool,prize_tiers,prize_slots,starts_at,ends_at,state,is_demo)
VALUES('00000000-0000-4000-8000-000000000001','pilot_demo','Demo adaptive cup','Demo only — no real prizes','[]',3,now()-interval '1 hour',now()+interval '7 days','open',true)
ON CONFLICT(id) DO NOTHING;
