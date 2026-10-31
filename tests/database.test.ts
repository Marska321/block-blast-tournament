import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
    CREATE TABLE public.players(id text,full_name text,phone text); GRANT ALL ON public.players TO anon,authenticated;
    INSERT INTO public.players VALUES('legacy','Private Person','+27820000000');`);
  await db.exec(await readFile("supabase/schema.sql", "utf8"));
  await db.exec("SET ROLE service_role");
});
after(async () => {
  await db?.close();
});

test("global star totals are aggregated before the API row limit and board responses stay bounded", async () => {
  await db.exec("RESET ROLE");
  const cohort = (
    await db.query<{ id: string }>(
      "INSERT INTO auth.users SELECT gen_random_uuid() FROM generate_series(1,21) RETURNING id",
    )
  ).rows.map((r) => r.id);
  await db.exec("SET ROLE service_role");
  for (const id of cohort) {
    await db.query(
      "INSERT INTO public.pilot_profiles(user_id,nickname) VALUES($1,'Star player')",
      [id],
    );
    await db.query(
      "INSERT INTO public.pilot_progress(user_id,level,stars,best_score) SELECT $1,level,3,100 FROM generate_series(1,60) AS level",
      [id],
    );
  }
  const e = await event();
  const board = (
    await db.query<any>("SELECT public.pilot_board($1,$2) AS b", [
      e,
      cohort[20],
    ])
  ).rows[0].b;
  assert.equal(board.stars.length, 20);
  assert.equal(board.myStars, 180);
  assert.equal(board.maxStars, 180);
  assert.deepEqual(board.tournament, []);
});
async function user() {
  const id = randomUUID();
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO auth.users VALUES($1)", [id]);
  await db.exec("SET ROLE service_role");
  return id;
}
async function event() {
  const id = randomUUID();
  await db.query(
    `INSERT INTO public.pilot_events(id,cup_id,title,prize_pool,starts_at,ends_at,state,is_demo) VALUES($1::uuid,$1::text,'Test event','Test vouchers',now()-interval '1 hour',now()+interval '1 day','open',false)`,
    [id],
  );
  return id;
}
async function start(
  u: string,
  e: string | null,
  request = randomUUID(),
  kind = "tournament",
  level: number | null = null,
) {
  return (
    await db.query<{ r: any }>(
      `SELECT public.pilot_start($1,$2,$3,$4,$5,123,'pilot-1','Player',true) AS r`,
      [u, request, e, kind, level],
    )
  ).rows[0].r;
}
async function accept(u: string, r: string, score = 100, hash = "hash") {
  return (
    await db.query<{ r: any }>(`SELECT public.pilot_accept($1,$2,$3,$4) AS r`, [
      u,
      r,
      hash,
      JSON.stringify({
        score,
        stars: 1,
        completed: true,
        engineVersion: "pilot-1",
      }),
    ])
  ).rows[0].r;
}

test("RLS and grants deny public private-data reads, arbitrary writes, and direct RPC execution", async () => {
  const a = await user(),
    b = await user(),
    e = await event();
  await start(a, e);
  await start(b, e);
  await db.exec("SET ROLE anon");
  await assert.rejects(
    db.query("SELECT * FROM public.players"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("SELECT * FROM public.pilot_claims"),
    /permission denied/,
  );
  await assert.rejects(
    db.query(
      `SELECT public.pilot_start($1,$2,$3,'tournament',null,1,'pilot-1','Fake',true)`,
      [a, randomUUID(), e],
    ),
    /permission denied/,
  );
  await db.exec("SET ROLE authenticated");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [a]);
  const rows = await db.query("SELECT user_id FROM public.pilot_profiles");
  assert.deepEqual(rows.rows, [{ user_id: a }]);
  await assert.rejects(
    db.query(`UPDATE public.pilot_profiles SET adult_attested=true`),
    /permission denied/,
  );
  await assert.rejects(
    db.query("DELETE FROM public.pilot_referrals"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("UPDATE public.pilot_wallets SET bonus_earned=2"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("INSERT INTO public.pilot_runs DEFAULT VALUES"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("SELECT * FROM public.pilot_claims"),
    /permission denied/,
  );
  await db.exec("SET ROLE service_role");
});

test("daily balances reset by South Africa date and old bonuses do not carry forward", async () => {
  const u = await user(),
    e = await event();
  await db.query(
    "INSERT INTO public.pilot_profiles(user_id,nickname) VALUES($1,'Daily player')",
    [u],
  );
  await db.query(
    "INSERT INTO public.pilot_wallets(user_id,day,base_used,bonus_earned) VALUES($1,(now() AT TIME ZONE 'Africa/Johannesburg')::date-1,3,2)",
    [u],
  );
  const run = await start(u, e);
  const result = await db.query<any>(
    "SELECT base_used,bonus_earned FROM public.pilot_wallets WHERE user_id=$1 AND day=(now() AT TIME ZONE 'Africa/Johannesburg')::date",
    [u],
  );
  assert.deepEqual(result.rows, [{ base_used: 1, bonus_earned: 0 }]);
  const end = (
    await db.query<any>("SELECT ends_at FROM public.pilot_events WHERE id=$1", [
      e,
    ])
  ).rows[0].ends_at;
  assert.equal(new Date(run.expires_at).getTime(), new Date(end).getTime());
});

test("rate limits persist across independent calls instead of relying on process memory", async () => {
  const key = randomUUID();
  const values = [];
  for (let i = 0; i < 4; i++)
    values.push(
      (
        await db.query<any>("SELECT public.pilot_rate_limit($1,3,60) AS ok", [
          key,
        ])
      ).rows[0].ok,
    );
  assert.deepEqual(values, [true, true, true, false]);
});

test("closed events reject new scores and demo/expired/unqualified claims cannot be issued", async () => {
  const u = await user(),
    outsider = await user(),
    e = await event();
  const first = await start(u, e),
    second = await start(u, e);
  await accept(u, first.id, 300);
  await db.query(
    "UPDATE public.pilot_events SET ends_at=now()-interval '1 minute',state='closed',is_demo=true WHERE id=$1",
    [e],
  );
  await assert.rejects(accept(u, second.id, 400), /event_unavailable/);
  await assert.rejects(
    db.query("SELECT public.pilot_create_claim($1,$2,'code')", [u, e]),
    /claim_window_closed/,
  );
  await db.query("UPDATE public.pilot_events SET is_demo=false WHERE id=$1", [
    e,
  ]);
  await assert.rejects(
    db.query("SELECT public.pilot_create_claim($1,$2,'code')", [outsider, e]),
    /adult_required/,
  );
  await db.query(
    "INSERT INTO public.pilot_profiles(user_id,nickname,adult_attested) VALUES($1,'No result',true)",
    [outsider],
  );
  await assert.rejects(
    db.query("SELECT public.pilot_create_claim($1,$2,'code')", [outsider, e]),
    /not_eligible/,
  );
  await db.query(
    "UPDATE public.pilot_events SET starts_at=now()-interval '5 days',ends_at=now()-interval '49 hours' WHERE id=$1",
    [e],
  );
  await assert.rejects(
    db.query("SELECT public.pilot_create_claim($1,$2,'code')", [u, e]),
    /claim_window_closed/,
  );
});
test("simultaneous idempotent starts consume once and attempts are shared across cups", async () => {
  const u = await user(),
    e = await event(),
    other = await event(),
    request = randomUUID();
  const runs = await Promise.all(
    Array.from({ length: 4 }, () => start(u, e, request)),
  );
  assert.equal(new Set(runs.map((r) => r.id)).size, 1);
  await start(u, other);
  await start(u, e);
  await assert.rejects(start(u, e), /tickets_exhausted/);
  await assert.rejects(start(u, other, request), /request_conflict/);
  const wallet = (
    await db.query<any>("SELECT * FROM public.pilot_wallets WHERE user_id=$1", [
      u,
    ])
  ).rows[0];
  assert.equal(wallet.base_used, 3);
});
test("unknown, closed, underage, and future events cannot issue sessions", async () => {
  const u = await user(),
    e = await event();
  await assert.rejects(start(u, randomUUID()), /event_unavailable/);
  await db.query(`UPDATE public.pilot_events SET state='closed' WHERE id=$1`, [
    e,
  ]);
  await assert.rejects(start(u, e), /event_unavailable/);
  await db.query(
    `UPDATE public.pilot_events SET state='open',starts_at=now()+interval '1 hour' WHERE id=$1`,
    [e],
  );
  await assert.rejects(start(u, e), /event_unavailable/);
  await assert.rejects(
    db.query(
      `SELECT public.pilot_start($1,$2,$3,'tournament',null,1,'pilot-1','Minor',false)`,
      [u, randomUUID(), e],
    ),
    /adult_required/,
  );
});
test("acceptance is single-use, owner-bound, expires, and ranks best runs with deterministic ties", async () => {
  const a = await user(),
    b = await user(),
    e = await event();
  const r = await start(a, e);
  await assert.rejects(accept(b, r.id), /session_not_found/);
  const first = await accept(a, r.id, 500);
  const retried = await accept(a, r.id, 500);
  assert.equal(first.duplicate, false);
  assert.equal(retried.duplicate, true);
  assert.deepEqual({ ...retried, duplicate: false }, first);
  await assert.rejects(accept(a, r.id, 501, "changed"), /replay_conflict/);
  const a2 = await start(a, e);
  await accept(a, a2.id, 300);
  const b1 = await start(b, e);
  await accept(b, b1.id, 500);
  const standings = (
    await db.query<any>("SELECT * FROM public.pilot_standings($1)", [e])
  ).rows;
  assert.equal(standings.length, 2);
  assert.equal(standings[0].user_id, a);
  assert.equal(Number(standings[1].rank), 2);
  const expired = await start(b, e);
  await db.query(
    `UPDATE public.pilot_runs SET expires_at=now()-interval '1 second' WHERE id=$1`,
    [expired.id],
  );
  await assert.rejects(accept(b, expired.id), /session_expired/);
});

test("profile updates cannot accidentally revoke a prior adult attestation", async () => {
  const u = await user();
  await db.query("SELECT public.pilot_profile($1,'Player',true)", [u]);
  await db.query("SELECT public.pilot_profile($1,'Renamed player',false)", [u]);
  const row = (
    await db.query<any>(
      "SELECT nickname,adult_attested FROM public.pilot_profiles WHERE user_id=$1",
      [u],
    )
  ).rows[0];
  assert.deepEqual(row, { nickname: "Renamed player", adult_attested: true });
});
test("referrals require prior attribution and accepted games; retries cannot multiply daily bonuses", async () => {
  const referrer = await user(),
    e = await event();
  await start(referrer, e);
  for (let i = 0; i < 3; i++) {
    const referred = await user();
    const run = await start(referred, e);
    assert.equal(
      (
        await db.query<any>(
          "SELECT public.pilot_attribute_referral($1,$2) AS ok",
          [referred, referrer],
        )
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query<any>(
          "SELECT public.pilot_attribute_referral($1,$2) AS ok",
          [referred, referrer],
        )
      ).rows[0].ok,
      false,
    );
    await Promise.all([
      accept(referred, run.id, 100),
      accept(referred, run.id, 100),
    ]);
  }
  const wallet = (
    await db.query<any>("SELECT * FROM public.pilot_wallets WHERE user_id=$1", [
      referrer,
    ])
  ).rows[0];
  assert.equal(wallet.bonus_earned, 2);
  assert.equal(
    (
      await db.query<any>(
        "SELECT public.pilot_attribute_referral($1,$1) AS ok",
        [referrer],
      )
    ).rows[0].ok,
    false,
  );
});
test("level completion writes best stars without accepting client table writes", async () => {
  const u = await user();
  await assert.rejects(
    start(u, null, randomUUID(), "levels", 2),
    /level_locked/,
  );
  const run = await start(u, null, randomUUID(), "levels", 1);
  await accept(u, run.id, 100);
  const progress = (
    await db.query<any>(
      "SELECT * FROM public.pilot_progress WHERE user_id=$1",
      [u],
    )
  ).rows[0];
  assert.equal(progress.stars, 1);
  await start(u, null, randomUUID(), "levels", 2);
});
test("claims require closed real events, winning positions, live codes, and explicit adult/result review", async () => {
  const a = await user(),
    b = await user(),
    e = await event();
  const ra = await start(a, e),
    rb = await start(b, e);
  await accept(a, ra.id, 500);
  await accept(b, rb.id, 400);
  await assert.rejects(
    db.query(`SELECT public.pilot_create_claim($1,$2,'old')`, [a, e]),
    /claim_window_closed/,
  );
  await db.query(
    `UPDATE public.pilot_events SET ends_at=now()-interval '1 minute',state='closed' WHERE id=$1`,
    [e],
  );
  const claim = (
    await db.query<any>(`SELECT public.pilot_create_claim($1,$2,'old') AS c`, [
      a,
      e,
    ])
  ).rows[0].c;
  await db.query(`SELECT public.pilot_create_claim($1,$2,'new')`, [a, e]);
  const review = (hash: string, adult = true, reviewed = true) =>
    db.query(
      `SELECT public.pilot_review_claim($1,$2,'+27821234567','Private Winner',$3,$4,'approved','Eligibility and result checked')`,
      [claim.claimId, hash, adult, reviewed],
    );
  await assert.rejects(review("old"), /claim_code_invalid/);
  await assert.rejects(review("new", false), /review_required/);
  await assert.rejects(review("new", true, false), /review_required/);
  await review("new");
  await assert.rejects(review("new"), /claim_unavailable/);
  const second = (
    await db.query<any>(
      `SELECT public.pilot_create_claim($1,$2,'second') AS c`,
      [b, e],
    )
  ).rows[0].c;
  await assert.rejects(
    db.query(
      `SELECT public.pilot_review_claim($1,'second','+27821234567','Other Winner',true,true,'approved','All checks completed')`,
      [second.claimId],
    ),
    /duplicate_phone_review/,
  );
  await db.query(
    `UPDATE public.pilot_claims SET code_expires_at=now()-interval '1 second' WHERE id=$1`,
    [second.claimId],
  );
  await assert.rejects(
    db.query(
      `SELECT public.pilot_review_claim($1,'second','+27821234568','Other Winner',true,true,'approved','All checks completed')`,
      [second.claimId],
    ),
    /claim_code_invalid/,
  );
  await db.query(`SELECT public.pilot_create_claim($1,$2,'replacement')`, [b, e]);
  await db.query(
    `SELECT public.pilot_review_claim($1,'replacement','+27821234567','',false,false,'rejected','Duplicate contact reviewed; claim rejected')`,
    [second.claimId],
  );
  const rejected = (await db.query<any>(
    `SELECT status,review_reason FROM public.pilot_claims WHERE id=$1`,
    [second.claimId],
  )).rows[0];
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.review_reason, 'Duplicate contact reviewed; claim rejected');
});
