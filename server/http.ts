import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ApiRequest extends IncomingMessage {
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
}
export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse;
  json(value: unknown): void;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
export interface Context {
  db: SupabaseClient;
  userId: string | null;
}
const messages: Record<string, string> = {
  tickets_exhausted:
    "No tickets remain today. Tickets reset at midnight South Africa time.",
  event_unavailable:
    "This event is not open. Choose another event or play Classic.",
  session_expired:
    "This ranked session has closed and can no longer enter the standings. Your local record is still available.",
  session_not_found:
    "This browser account cannot access that run. Guest accounts cannot be recovered automatically.",
  adult_required:
    "Official entries and prizes are for adults aged 18 or older. Classic and Levels are available to everyone.",
  request_conflict:
    "That request belongs to another attempt. Reload the event before starting again.",
  replay_conflict: "This session already has a different accepted result.",
  illegal_replay:
    "The replay could not be validated. This run was not accepted.",
  run_incomplete:
    "Finish a run with at least one placed piece before submitting it.",
  level_locked:
    "Replay earlier levels to establish validated global progress. Your local progress is still on this device.",
  claim_window_closed:
    "Claims open when the event ends and close 48 hours later. Demo events have no prizes.",
  claim_already_reviewed:
    "Your claim has already been reviewed. Check its status in the leaderboard.",
  not_eligible:
    "This account is not in an eligible prize position for that event.",
};

export function database(feature: "pilot" | "classic" = "pilot") {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const enabled = feature === "classic" ? process.env.CLASSIC_RANKED_ENABLED : process.env.PILOT_ENABLED;
  if (!url || !key || enabled !== "true")
    throw new ApiError(
      503,
      feature === "classic" ? "classic_unavailable" : "official_unavailable",
      feature === "classic" ? "Daily rankings are unavailable. Local Classic and Levels are ready to play." :
        "Official play is not available yet. You can still play Classic or Levels.",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(
  db: SupabaseClient,
  req: Pick<ApiRequest, "headers">,
  required = true,
) {
  const auth = req.headers.authorization;
  if (!auth) {
    if (required) throw new ApiError(401, "authentication_required");
    return null;
  }
  if (!/^Bearer \S+$/.test(auth))
    throw new ApiError(401, "invalid_authentication");
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new ApiError(401, "invalid_authentication");
  return data.user.id;
}

export function body(req: ApiRequest): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    throw new ApiError(400, "invalid_body");
  if (Buffer.byteLength(JSON.stringify(req.body)) > 1024 * 1024)
    throw new ApiError(413, "replay_too_large");
  return req.body as Record<string, unknown>;
}
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ApiError(400, "invalid_identifier");
  return value;
}
export function nickname(value: unknown) {
  if (typeof value !== "string") throw new ApiError(400, "invalid_nickname");
  const clean = value.trim();
  if (!clean || clean.length > 24 || /[\u0000-\u001f\u007f<>]/.test(clean))
    throw new ApiError(
      400,
      "invalid_nickname",
      "Use 1–24 characters without HTML.",
    );
  return clean;
}
const errors: Record<string, number> = {
  request_conflict: 409,
  replay_conflict: 409,
  tickets_exhausted: 409,
  adult_required: 403,
  event_unavailable: 409,
  session_expired: 410,
  session_not_found: 404,
  invalid_level: 400,
  invalid_session: 400,
  level_locked: 403,
  invalid_nickname: 400,
  invalid_day: 400,
  level_incomplete: 400,
  claim_window_closed: 409,
  claim_already_reviewed: 409,
  not_eligible: 403,
};
export async function rpc<T>(
  db: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    const code = Object.keys(errors).find((k) => error.message === k);
    if (code) throw new ApiError(errors[code], code);
    throw new ApiError(
      503,
      "storage_unavailable",
      "Could not save your request. Retry with the same session.",
    );
  }
  return data as T;
}
export async function rateLimit(db: SupabaseClient, key: string, limit = 60) {
  if (
    !(await rpc<boolean>(db, "pilot_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_seconds: 60,
    }))
  )
    throw new ApiError(
      429,
      "rate_limited",
      "Please wait a minute and try again.",
    );
}
export function route(
  method: "GET" | "POST",
  handler: (req: ApiRequest, ctx: Context) => Promise<unknown>,
  auth: "required" | "optional" | "none" = "required",
  feature: "pilot" | "classic" = "pilot",
) {
  return async (req: ApiRequest, res: ApiResponse) => {
    const started = Date.now();
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== method) {
      res.setHeader("Allow", method);
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    try {
      const db = database(feature);
      const userId =
        auth === "none"
          ? null
          : await authenticate(db, req, auth === "required");
      // Vercel supplies this header; it is used only for throttling, never identity.
      const ip = String(
        req.headers["x-vercel-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "unknown",
      ).slice(0, 80);
      const { createHash } = await import("node:crypto");
      const bucket = userId || createHash("sha256").update(ip).digest("hex");
      await rateLimit(
        db,
        `${method}:${req.url?.split("?")[0]}:${bucket}`,
        method === "POST" ? 30 : 90,
      );
      const result = await handler(req, { db, userId });
      console.log(
        JSON.stringify({
          event: "pilot_request",
          operation: handler.name,
          status: 200,
          duplicate:
            typeof result === "object" &&
            result !== null &&
            "duplicate" in result
              ? Boolean(result.duplicate)
              : undefined,
          durationMs: Date.now() - started,
        }),
      );
      res.status(200).json(result);
    } catch (error) {
      const safe =
        error instanceof ApiError
          ? error
          : new ApiError(
              500,
              "internal_error",
              "The request could not be completed.",
            );
      // Never log request bodies, bearer tokens, contact details, or claim codes.
      console.error(
        JSON.stringify({
          event: "pilot_request",
          operation: handler.name,
          code: safe.code,
          status: safe.status,
          durationMs: Date.now() - started,
        }),
      );
      res.status(safe.status).json({
        error: safe.code,
        message: messages[safe.code] || safe.message,
      });
    }
  };
}
