import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classicBoard, classicWrite } from "../server/classic";
import { database, type ApiRequest } from "../server/http";
import { GameEngine } from "../shared/engine";
import { canPlaceBlockAtPosition } from "../shared/mechanics";
const user = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const request = (body: unknown, day?: string) => ({ body, query: { day }, headers: {} }) as ApiRequest;
function backend(fail = false) {
  const writes: { name: string; args: any }[] = [];
  const filters: Record<string, unknown> = {};
  const chain = {
    select() { return this; },
    eq(key: string, value: unknown) { filters[key] = value; return this; },
    async maybeSingle() { return { error: null, data: filters.user_id === user ? {
      id, seed: 1, engine_version: "pilot-1", user_id: user,
    } : null }; },
  };
  const db = {
    from: () => chain,
    rpc: async (name: string, args: unknown) => {
      writes.push({ name, args });
      return fail ? { data: null, error: { message: "private failure" } } :
        { data: name === "pilot_rate_limit" ? true : { success: true }, error: null };
    },
  } as unknown as SupabaseClient;
  return { ctx: { db, userId: user }, writes };
}
function played() {
  const game = new GameEngine({ kind: "classic", seed: 1 });
  while (game.score < 100 && !game.over) {
    let action;
    for (let slot = 0; slot < 3 && !action; slot++) if (game.tray[slot].active)
      for (let y = 0; y < 8 && !action; y++) for (let x = 0; x < 8 && !action; x++)
        if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y)) action = { type: "place" as const, slot, x, y };
    assert.ok(action); game.apply(action);
  }
  if (!game.over) game.apply({ type: "end" });
  return game;
}
test("Classic API rejects caller-owned seeds, identity, scores, revive credits and invalid dates", async () => {
  const { ctx, writes } = backend();
  for (const extra of [{ seed: 1 }, { userId: id }, { adult: true }, { tickets: 100 }])
    await assert.rejects(classicWrite(request({ operation: "start", requestId: id, nickname: "Player", ...extra }), ctx), /unexpected_fields/);
  for (const extra of [{ score: 99999 }, { revives: 3 }, { day: "2026-01-01" }])
    await assert.rejects(classicWrite(request({ operation: "submit", sessionId: id, actions: played().actions, ...extra }), ctx), /unexpected_fields/);
  for (const day of ["2026-02-31", "tomorrow", "2026-13-01"])
    await assert.rejects(classicBoard(request(null, day), ctx), /invalid_day/);
  assert.equal(writes.length, 0);
  await classicWrite(request({ operation: "start", requestId: id, nickname: "Player" }), ctx);
  const start = writes.find(w => w.name === "classic_start")!;
  assert.equal(start.args.p_user, user);
  assert.ok(Number.isInteger(start.args.p_seed));
  assert.equal(start.args.p_version, "pilot-1");
});
test("Classic submissions replay server-issued state, reject illegal/unfinished runs, and never mock storage success", async () => {
  const { ctx, writes } = backend();
  await assert.rejects(classicWrite(request({ operation: "submit", sessionId: id, actions: [{ type: "end" }] }), ctx), /run_incomplete/);
  await assert.rejects(classicWrite(request({ operation: "submit", sessionId: id, actions: [{ type: "place", slot: 0, x: 99, y: 0 }] }), ctx), /illegal_replay/);
  await assert.rejects(classicWrite(request({ operation: "submit", sessionId: id, actions: played().actions }), { ...ctx, userId: id }), /session_not_found/);
  await classicWrite(request({ operation: "submit", sessionId: id, actions: played().actions }), ctx);
  const accepted = writes.find(w => w.name === "classic_accept")!;
  assert.equal(accepted.args.p_score, played().score);
  assert.equal(accepted.args.p_revives, 0);
  assert.equal(accepted.args.p_user, user);
  assert.equal(accepted.args.p_hash.length, 64);
  await assert.rejects(classicWrite(request({ operation: "submit", sessionId: id, actions: played().actions }), backend(true).ctx), /Could not save/);
});
test("ranked Classic and prize APIs have independent fail-closed configuration gates", () => {
  const original = process.env.CLASSIC_RANKED_ENABLED;
  process.env.CLASSIC_RANKED_ENABLED = "false";
  assert.throws(() => database("classic"), /Daily rankings are unavailable/);
  if (original === undefined) delete process.env.CLASSIC_RANKED_ENABLED;
  else process.env.CLASSIC_RANKED_ENABLED = original;
});
