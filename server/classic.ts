import { createHash, randomBytes } from "node:crypto";
import { ENGINE_VERSION, replay, validateActions } from "../shared/engine.js";
import type { ClassicBoard, ClassicReceipt, ClassicSession } from "../shared/classic.js";
import { ApiError, body, nickname, rpc, uuid, rateLimit, type ApiRequest, type Context } from "./http.js";

export async function classicBoard(req: ApiRequest, { db, userId }: Context) {
  const day = req.query.day;
  if (day !== undefined && (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day))
    throw new ApiError(400, "invalid_day");
  const board = await rpc<Omit<ClassicBoard, "demo">>(db, "classic_board", {
    p_day: day || null, p_user: userId,
  });
  return { ...board, demo: process.env.CLASSIC_DEMO === "true" };
}

export async function classicWrite(req: ApiRequest, ctx: Context) {
  const input = body(req);
  if (input.operation === "start") {
    if (Object.keys(input).some(key => !["operation", "requestId", "nickname"].includes(key)))
      throw new ApiError(400, "unexpected_fields");
    await rateLimit(ctx.db, `classic:start:${ctx.userId}`, 10);
    return rpc<ClassicSession>(ctx.db, "classic_start", {
      p_user: ctx.userId, p_request: uuid(input.requestId),
      p_seed: randomBytes(4).readUInt32LE(), p_version: ENGINE_VERSION,
      p_nickname: nickname(input.nickname),
    });
  }
  if (input.operation !== "submit" || Object.keys(input).some(key =>
    !["operation", "sessionId", "actions"].includes(key))) throw new ApiError(400, "unexpected_fields");
  const id = uuid(input.sessionId);
  const { data: run, error } = await ctx.db.from("classic_runs")
    .select("id,user_id,day,seed,engine_version,expires_at").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
  if (error) throw new ApiError(503, "storage_unavailable");
  if (!run) throw new ApiError(404, "session_not_found");
  if (run.engine_version !== ENGINE_VERSION) throw new ApiError(409, "engine_version_unavailable");
  try { validateActions(input.actions); } catch { throw new ApiError(400, "invalid_replay"); }
  let game;
  try { game = replay({ kind: "classic", seed: Number(run.seed) }, input.actions); }
  catch { throw new ApiError(400, "illegal_replay"); }
  if (!game.over || game.moves < 1) throw new ApiError(400, "run_incomplete");
  const hash = createHash("sha256").update(JSON.stringify(game.actions)).digest("hex");
  return rpc<ClassicReceipt>(ctx.db, "classic_accept", {
    p_user: ctx.userId, p_run: id, p_hash: hash, p_actions: game.actions,
    p_score: game.score, p_moves: game.moves, p_revives: game.revived ? 1 : 0,
  });
}
