import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticate,
  ApiError,
  route,
  type ApiRequest,
  type ApiResponse,
  type Context,
} from "../server/http";
import {
  start,
  submit,
  submitProgress,
  referral,
  createClaim,
} from "../server/routes";
import { GameEngine } from "../shared/engine";
const actor = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const request = (body: unknown) =>
  ({ body, headers: {}, query: {} }) as ApiRequest;
function backend(run: unknown, failure = false) {
  const writes: { name: string; args: Record<string, unknown> }[] = [];
  const chain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: run, error: null }),
  };
  const db = {
    from: () => chain,
    auth: {
      getUser: async (token: string) => ({
        data: { user: token === "valid" ? { id: actor } : null },
        error: token === "valid" ? null : { message: "invalid" },
      }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      writes.push({ name, args });
      return failure
        ? { data: null, error: { message: "private database error" } }
        : {
            data:
              name === "pilot_start"
                ? run
                : name === "pilot_standings"
                  ? []
                  : {
                      scoreId: runId,
                      score: (args.p_result as any)?.score,
                      stars: (args.p_result as any)?.stars || 0,
                      acceptedAt: new Date().toISOString(),
                    },
            error: null,
          };
    },
  } as unknown as SupabaseClient;
  return { ctx: { db, userId: actor } as Context, writes };
}
test("server authentication verifies bearer tokens and never trusts a body player ID", async () => {
  const { ctx } = backend(null);
  await assert.rejects(
    authenticate(ctx.db, { headers: {} }),
    (e) => e instanceof ApiError && e.status === 401,
  );
  await assert.rejects(
    authenticate(ctx.db, { headers: { authorization: "Bearer forged" } }),
    (e) => e instanceof ApiError && e.status === 401,
  );
  assert.equal(
    await authenticate(ctx.db, { headers: { authorization: "Bearer valid" } }),
    actor,
  );
  assert.equal(await authenticate(ctx.db, { headers: {} }, false), null);
});

test("offline level replays earn calculated stars, not caller-provided progress", async () => {
  const actions = [
    { type: "place", slot: 0, x: 0, y: 0 },
    { type: "place", slot: 1, x: 2, y: 0 },
    { type: "place", slot: 2, x: 3, y: 0 },
    { type: "place", slot: 0, x: 4, y: 0 },
    { type: "place", slot: 1, x: 3, y: 1 },
    { type: "place", slot: 2, x: 7, y: 0 },
    { type: "place", slot: 0, x: 0, y: 0 },
    { type: "place", slot: 1, x: 5, y: 1 },
    { type: "place", slot: 2, x: 0, y: 1 },
  ];
  const { ctx, writes } = backend({
    id: runId,
    user_id: actor,
    kind: "levels",
    level: 1,
    seed: 1,
    engine_version: "pilot-1",
    event_id: null,
  });
  await assert.rejects(
    submitProgress(
      request({
        requestId: runId,
        level: 1,
        seed: 1,
        nickname: "Player",
        stars: 3,
        actions,
      }),
      ctx,
    ),
    /unexpected_fields/,
  );
  const receipt = await submitProgress(
    request({
      requestId: runId,
      level: 1,
      seed: 1,
      nickname: "Player",
      actions,
    }),
    ctx,
  );
  assert.equal(receipt.score, 1810);
  assert.equal(receipt.stars, 3);
  assert.deepEqual(
    writes.map((w) => w.name),
    ["pilot_start", "pilot_accept"],
  );
  assert.deepEqual(writes[1].args.p_actions, actions);
});
test("missing and malformed legacy tokens and fabricated scores cannot reach score writes", async () => {
  const { ctx, writes } = backend(null);
  for (const token of [undefined, "malformed"])
    await assert.rejects(
      submit(request({ playerId: actor, score: 1e9, token }), ctx),
      /unexpected_fields/,
    );
  assert.equal(writes.length, 0);
});
test("server reconstructs the accepted score and storage failures never become success", async () => {
  const game = new GameEngine({ kind: "tournament", seed: 1 });
  game.apply({ type: "place", slot: 0, x: 0, y: 0 });
  game.apply({ type: "end" });
  const run = {
    id: runId,
    user_id: actor,
    kind: "tournament",
    seed: 1,
    engine_version: "pilot-1",
    level: null,
    event_id: null,
  };
  const { ctx, writes } = backend(run);
  const receipt = await submit(
    request({ sessionId: runId, actions: game.actions }),
    ctx,
  );
  assert.equal(receipt.score, game.score);
  assert.equal((writes[0].args.p_result as any).score, game.score);
  await assert.rejects(
    submit(
      request({ sessionId: runId, actions: game.actions }),
      backend(run, true).ctx,
    ),
    (e) => e instanceof ApiError && e.status === 503,
  );
});
test("wrong-owner/missing runs, illegal moves, and incomplete runs cannot be accepted", async () => {
  await assert.rejects(
    submit(
      request({ sessionId: runId, actions: [{ type: "end" }] }),
      backend(null).ctx,
    ),
    /session_not_found/,
  );
  const { ctx, writes } = backend({
    id: runId,
    kind: "tournament",
    seed: 1,
    engine_version: "pilot-1",
  });
  await assert.rejects(
    submit(
      request({
        sessionId: runId,
        actions: [{ type: "place", slot: 0, x: -1, y: 0 }],
      }),
      ctx,
    ),
    /illegal_replay/,
  );
  await assert.rejects(
    submit(
      request({
        sessionId: runId,
        actions: [{ type: "place", slot: 0, x: 0, y: 0 }],
      }),
      ctx,
    ),
    /run_incomplete/,
  );
  assert.equal(writes.length, 0);
});
test("start and referrals cannot accept client identity or client gameplay evidence", async () => {
  const { ctx, writes } = backend(null);
  await assert.rejects(
    start(
      request({
        eventId: runId,
        requestId: runId,
        nickname: "Player",
        adult: false,
      }),
      ctx,
    ),
    /adult_required/,
  );
  await assert.rejects(
    referral(
      request({ referrerId: runId, referredId: actor, score: 100 }),
      ctx,
    ),
    /unexpected_fields/,
  );
  await assert.rejects(
    referral(request({ referrerId: actor }), ctx),
    /self_referral/,
  );
  assert.equal(writes.length, 0);
});
test("claim requests do not approve claims and require an operator destination", async () => {
  const old = process.env.TOURNAMENT_WHATSAPP_NUMBER;
  try {
    delete process.env.TOURNAMENT_WHATSAPP_NUMBER;
    await assert.rejects(
      createClaim(request({ eventId: runId, adult: true }), backend(null).ctx),
      /claims_unavailable/,
    );
  } finally {
    if (old) process.env.TOURNAMENT_WHATSAPP_NUMBER = old;
  }
});
test("HTTP method and missing configuration fail closed with no mock receipt", async () => {
  const old = process.env.PILOT_ENABLED;
  delete process.env.PILOT_ENABLED;
  try {
    const responses: any[] = [];
    let status = 0;
    const res = {
      setHeader() {},
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        responses.push({ status, body });
      },
    } as unknown as ApiResponse;
    const handler = route("POST", async () => ({ success: true }));
    await handler({ method: "GET" } as ApiRequest, res);
    await handler({ method: "POST" } as ApiRequest, res);
    assert.deepEqual(
      responses.map((r) => r.status),
      [405, 503],
    );
    assert.equal(responses[1].body.success, undefined);
  } finally {
    if (old) process.env.PILOT_ENABLED = old;
  }
});
