import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);`);
  await db.exec(await readFile("supabase/classic.sql", "utf8"));
  await db.exec("SET ROLE service_role");
});
after(async () => { await db?.close(); });
async function user() {
  const id = randomUUID();
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO auth.users VALUES($1)", [id]);
  await db.exec("SET ROLE service_role");
  return id;
}
async function start(id: string, request = randomUUID(), nick = "Player") {
  return (await db.query<any>("SELECT public.classic_start($1,$2,123,'pilot-1',$3) r", [id, request, nick])).rows[0].r;
}
async function accept(id: string, run: string, score = 100, hash = "hash") {
  return (await db.query<any>("SELECT public.classic_accept($1,$2,$3,'[{\"type\":\"end\"}]', $4,3,1) r", [id, run, hash, score])).rows[0].r;
}
async function board(id: string | null = null, day: string | null = null) {
  return (await db.query<any>("SELECT public.classic_board($1,$2) r", [day, id])).rows[0].r;
}
test("ranked Classic tables and routines deny direct anonymous and guest access", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`RESET ROLE; SET ROLE ${role}`);
    await assert.rejects(db.query("SELECT * FROM public.classic_profiles"), /permission denied/);
    await assert.rejects(db.query("INSERT INTO public.classic_daily_best(day,user_id,run_id,nickname,score,accepted_at) VALUES(current_date,gen_random_uuid(),gen_random_uuid(),'Fake',9999,now())"), /permission denied/);
    await assert.rejects(db.query("SELECT public.classic_board()"), /permission denied/);
    await assert.rejects(db.query("SELECT public.classic_start(gen_random_uuid(),gen_random_uuid(),1,'pilot-1','Fake')"), /permission denied/);
  }
  await db.exec("RESET ROLE; SET ROLE service_role");
});
test("free starts are idempotent and expire at the South African day boundary", async () => {
  const id = await user(), request = randomUUID();
  const first = await start(id, request, "First");
  const retry = await start(id, request, "Different");
  assert.deepEqual(first, retry);
  const { rows } = await db.query<any>("SELECT ((day+1)::timestamp AT TIME ZONE 'Africa/Johannesburg')=expires_at valid FROM public.classic_runs WHERE id=$1", [first.id]);
  assert.equal(rows[0].valid, true);
  assert.equal((await board()).today, first.day);
  await assert.rejects(start(await user(), undefined, "<img>"), /invalid_nickname/);
});
test("one best run per account, stable ties, owner-only acceptance and identical retry receipts", async () => {
  const a = await user(), b = await user();
  const run = await start(a, undefined, "Leader");
  await assert.rejects(accept(b, run.id), /session_not_found/);
  const receipt = await accept(a, run.id, 500);
  assert.deepEqual(await accept(a, run.id, 500), receipt);
  await assert.rejects(accept(a, run.id, 500, "other"), /replay_conflict/);
  await accept(b, (await start(b, undefined, "Tied")).id, 500);
  await accept(a, (await start(a)).id, 200);
  const result = await board(b);
  assert.equal(result.entries.filter((e: any) => e.nickname === "Leader").length, 1);
  assert.equal(result.me.rank, 2);
  assert.equal(result.me.pointsToNext, 1);
  assert.equal("user_id" in result.entries[0], false);
  assert.equal(result.streak.current, 1);
  await accept(b, (await start(b, undefined, "New leader")).id, 501);
  assert.equal((await board(b)).me.rank, 1);
  assert.equal((await board(b)).me.pointsToNext, null);
});
test("expired daily sessions cannot write a standing; accepted retries survive expiry", async () => {
  const id = await user();
  const run = await start(id);
  const receipt = await accept(id, run.id, 50);
  assert.equal(receipt.streak.playedToday, false);
  await db.query("UPDATE public.classic_runs SET day=day-1,created_at=created_at-interval '1 day',expires_at=expires_at-interval '1 day' WHERE id=$1", [run.id]);
  assert.deepEqual(await accept(id, run.id, 50), receipt);
  const expired = await start(id);
  await db.query("UPDATE public.classic_runs SET day=day-1,created_at=created_at-interval '1 day',expires_at=expires_at-interval '1 day' WHERE id=$1", [expired.id]);
  await assert.rejects(accept(id, expired.id), /session_expired/);
  await assert.rejects(board(null, "2099-01-01"), /invalid_day/);
  assert.equal((await board(id)).streak.current, 0);
});
test("streaks use qualifying days, preserve yesterday's streak, and retain the longest after gaps", async () => {
  const id = await user();
  const run = await start(id);
  for (const offset of [-8, -7, -6, -3, -2, -1]) {
    await db.query(`INSERT INTO public.classic_daily_best(day,user_id,run_id,nickname,score,accepted_at)
      SELECT d,$1,$2,'Streak',100,d::timestamp AT TIME ZONE 'Africa/Johannesburg'
      FROM (SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date+$3::integer d) x`, [id, run.id, offset]);
  }
  let result = (await board(id)).streak;
  assert.deepEqual(result, { current: 3, longest: 3, playedToday: false });
  await accept(id, run.id, 100);
  assert.deepEqual((await board(id)).streak, { current: 4, longest: 4, playedToday: true });
  result = (await db.query<any>("SELECT public.classic_streak($1,(now() AT TIME ZONE 'Africa/Johannesburg')::date+2) r", [id])).rows[0].r;
  assert.deepEqual(result, { current: 0, longest: 4, playedToday: false });
  const yesterday = (await db.query<any>("SELECT ((now() AT TIME ZONE 'Africa/Johannesburg')::date-1)::text d")).rows[0].d;
  assert.equal((await board(id, yesterday)).closed, true);
});
