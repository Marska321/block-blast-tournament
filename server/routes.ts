import { createHash, randomBytes } from "node:crypto";
import { ENGINE_VERSION, replay, validateActions } from "../shared/engine.js";
import type {
  ClaimStatus,
  PilotEvent,
  RunSession,
  ScoreReceipt,
  Standing,
} from "../shared/contracts.js";
import {
  ApiError,
  body,
  nickname,
  rpc,
  uuid,
  type ApiRequest,
  type Context,
} from "./http.js";

function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new ApiError(503, "storage_unavailable");
  return result.data;
}
export async function start(req: ApiRequest, { db, userId }: Context) {
  const input = body(req);
  if (
    Object.keys(input).some(
      (k) =>
        ![
          "requestId",
          "eventId",
          "kind",
          "level",
          "nickname",
          "adult",
        ].includes(k),
    )
  )
    throw new ApiError(400, "unexpected_fields");
  const kind = input.kind === "levels" ? "levels" : "tournament";
  if (input.kind && !["levels", "tournament"].includes(String(input.kind)))
    throw new ApiError(400, "invalid_mode");
  if (kind === "tournament" && input.adult !== true)
    throw new ApiError(403, "adult_required");
  const seed = randomBytes(4).readUInt32LE();
  return rpc<RunSession>(db, "pilot_start", {
    p_user: userId,
    p_request: uuid(input.requestId),
    p_event: kind === "tournament" ? uuid(input.eventId) : null,
    p_kind: kind,
    p_level: kind === "levels" ? input.level : null,
    p_seed: seed,
    p_version: ENGINE_VERSION,
    p_nickname: nickname(input.nickname),
    p_adult: input.adult === true,
  });
}
export async function submit(
  req: ApiRequest,
  { db, userId }: Context,
): Promise<ScoreReceipt> {
  const input = body(req);
  if (Object.keys(input).some((k) => !["sessionId", "actions"].includes(k)))
    throw new ApiError(400, "unexpected_fields");
  const id = uuid(input.sessionId);
  const run = checked(
    await db
      .from("pilot_runs")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
  ) as RunSession | null;
  if (!run) throw new ApiError(404, "session_not_found");
  if (run.engine_version !== ENGINE_VERSION)
    throw new ApiError(409, "engine_version_unavailable");
  try {
    validateActions(input.actions);
  } catch {
    throw new ApiError(400, "invalid_replay");
  }
  let game;
  try {
    game = replay(
      { kind: run.kind, seed: Number(run.seed), level: run.level || undefined },
      input.actions,
    );
  } catch {
    throw new ApiError(400, "illegal_replay");
  }
  if (
    !game.over ||
    game.moves < 1 ||
    (run.kind === "levels" && !game.completed)
  )
    throw new ApiError(400, "run_incomplete");
  const hash = createHash("sha256")
    .update(JSON.stringify(game.actions))
    .digest("hex");
  const receipt = await rpc<Omit<ScoreReceipt, "success" | "rank" | "eventId">>(
    db,
    "pilot_accept",
    {
      p_user: userId,
      p_run: id,
      p_hash: hash,
      p_actions: game.actions,
      p_result: {
        score: game.score,
        stars: game.stars,
        moves: game.moves,
        lines: game.lines,
        maxCombo: game.maxCombo,
        completed: game.completed,
        engineVersion: ENGINE_VERSION,
      },
    },
  );
  const standings = run.event_id
    ? await rpc<Standing[]>(db, "pilot_standings", {
        p_event: run.event_id,
        p_user: userId,
      })
    : [];
  return {
    ...receipt,
    success: true,
    eventId: run.event_id,
    rank: standings.find((s) => s.user_id === userId)?.rank ?? null,
  };
}
export async function events(_req: ApiRequest, { db }: Context) {
  const now = new Date();
  const since = new Date(now.getTime() - 48 * 3600_000).toISOString();
  const list = checked(
    await db
      .from("pilot_events")
      .select("*")
      .neq("state", "draft")
      .gt("ends_at", since)
      .order("starts_at", { ascending: false })
      .limit(30),
  );
  return {
    events: list,
    serverTime: now.toISOString(),
    claimsEnabled: /^\d{8,15}$/.test(
      process.env.TOURNAMENT_WHATSAPP_NUMBER || "",
    ),
  };
}
export async function leaderboard(req: ApiRequest, { db, userId }: Context) {
  const eventId = uuid(req.query.eventId);
  const event = checked(
    await db
      .from("pilot_events")
      .select("*")
      .eq("id", eventId)
      .neq("state", "draft")
      .maybeSingle(),
  ) as PilotEvent | null;
  if (!event) throw new ApiError(404, "event_not_found");
  const board = await rpc<Record<string, unknown>>(db, "pilot_board", {
    p_event: eventId,
    p_user: userId,
  });
  return { event, ...board, serverTime: new Date().toISOString() };
}
export async function balance(_req: ApiRequest, { db, userId }: Context) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const wallet = checked(
    await db
      .from("pilot_wallets")
      .select("base_used,bonus_used,bonus_earned")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle(),
  );
  return {
    remaining:
      3 -
      (wallet?.base_used || 0) +
      (wallet?.bonus_earned || 0) -
      (wallet?.bonus_used || 0),
    baseUsed: wallet?.base_used || 0,
    bonusEarned: wallet?.bonus_earned || 0,
    bonusUsed: wallet?.bonus_used || 0,
    day,
  };
}
export async function referral(req: ApiRequest, { db, userId }: Context) {
  const input = body(req);
  if (Object.keys(input).some((k) => k !== "referrerId"))
    throw new ApiError(400, "unexpected_fields");
  const referrer = uuid(input.referrerId);
  if (referrer === userId) throw new ApiError(400, "self_referral");
  return {
    attributed: await rpc<boolean>(db, "pilot_attribute_referral", {
      p_user: userId,
      p_referrer: referrer,
    }),
  };
}
export async function profile(req: ApiRequest, { db, userId }: Context) {
  const input = body(req);
  if (Object.keys(input).some((k) => !["nickname", "adult"].includes(k)))
    throw new ApiError(400, "unexpected_fields");
  await rpc(db, "pilot_profile", {
    p_user: userId,
    p_nickname: nickname(input.nickname),
    p_adult: input.adult === true,
  });
  return { success: true };
}
export async function progress(_req: ApiRequest, { db, userId }: Context) {
  return {
    progress: checked(
      await db
        .from("pilot_progress")
        .select("level,stars,best_score")
        .eq("user_id", userId)
        .order("level"),
    ),
  };
}
export async function submitProgress(req: ApiRequest, ctx: Context) {
  const input = body(req);
  if (
    Object.keys(input).some(
      (k) => !["requestId", "level", "seed", "actions", "nickname"].includes(k),
    )
  )
    throw new ApiError(400, "unexpected_fields");
  if (
    !Number.isInteger(input.level) ||
    Number(input.level) < 1 ||
    Number(input.level) > 60 ||
    !Number.isSafeInteger(input.seed) ||
    Number(input.seed) < 0 ||
    Number(input.seed) > 0xffffffff
  )
    throw new ApiError(400, "invalid_level");
  // Offline levels have no prize standing. Only a legal, complete replay can earn stars.
  try {
    validateActions(input.actions);
    const game = replay(
      { kind: "levels", level: Number(input.level), seed: Number(input.seed) },
      input.actions,
    );
    if (!game.completed) throw new Error("incomplete");
  } catch {
    throw new ApiError(400, "illegal_replay");
  }
  const run = await rpc<RunSession>(ctx.db, "pilot_start", {
    p_user: ctx.userId,
    p_request: uuid(input.requestId),
    p_event: null,
    p_kind: "levels",
    p_level: input.level,
    p_seed: input.seed,
    p_version: ENGINE_VERSION,
    p_nickname: nickname(input.nickname),
    p_adult: false,
  });
  // Request-id reuse must not swap the seed of a previously issued session.
  if (Number(run.seed) !== input.seed)
    throw new ApiError(409, "request_conflict");
  return submit(
    {
      ...req,
      body: { sessionId: run.id, actions: input.actions },
    } as ApiRequest,
    ctx,
  );
}
export async function createClaim(req: ApiRequest, { db, userId }: Context) {
  const input = body(req);
  const phone = process.env.TOURNAMENT_WHATSAPP_NUMBER || "";
  if (!/^\d{8,15}$/.test(phone)) throw new ApiError(503, "claims_unavailable");
  if (input.adult !== true) throw new ApiError(403, "adult_required");
  const code = randomBytes(24).toString("base64url");
  const claim = await rpc<{
    claimId: string;
    status: string;
    expiresAt: string;
  }>(db, "pilot_create_claim", {
    p_user: userId,
    p_event: uuid(input.eventId),
    p_hash: createHash("sha256").update(code).digest("hex"),
  });
  const message = `Prize claim ${claim.claimId}\nCode: ${code}\nI am 18 or older and would like my result reviewed.`;
  return {
    ...claim,
    whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
  };
}
export async function claims(_req: ApiRequest, { db, userId }: Context) {
  const list = checked(
    await db
      .from("pilot_claims")
      .select("id,event_id,status,reviewed_at,review_reason")
      .eq("user_id", userId)
      .order("requested_at", { ascending: false }),
  );
  return { claims: list as ClaimStatus[] };
}
