import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Balance,
  ClaimStatus,
  PilotEvent,
  ReplaySubmission,
  RunSession,
  ScoreReceipt,
  Standing,
} from "../shared/contracts";
import { dialog, text } from "./dialogs";
import { storage } from "./storage";
import { CASUAL_ONLY, CLASSIC_RANKED_ENABLED } from "./launch";
const env = import.meta.env;
let supabase: SupabaseClient | null = null;
function client() {
  if ((CASUAL_ONLY && !CLASSIC_RANKED_ENABLED) || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return null;
  return supabase ??= createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
}
export class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 0,
  ) {
    super(message);
  }
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}
let guestRequest: Promise<Session> | null = null;
export async function existingSession() {
  if (CASUAL_ONLY && storage.get("bb_classic_joined") !== "true") return null;
  const backend = client();
  return backend ? (await backend.auth.getSession()).data.session : null;
}

async function captcha(): Promise<string> {
  const sitekey = env.VITE_TURNSTILE_SITE_KEY;
  if (!sitekey)
    throw new RequestError(
      "Ranked entry is unavailable. You can still play local Classic and Levels.",
      "captcha_unavailable",
    );
  const { overlay, card } = dialog("captchaDialog", "Quick security check");
  card.append(
    text(
      "p",
      "This protects the free guest accounts. No email or phone number is needed.",
    ),
  );
  const target = document.createElement("div");
  card.append(target);
  type Widget = {
    render(el: HTMLElement, options: Record<string, unknown>): string;
    remove(id: string): void;
  };
  const provider = window as unknown as { turnstile?: Widget };
  if (!provider.turnstile)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.onload = () => resolve();
      script.onerror = () => {
        overlay.classList.remove("active");
        reject(
          new RequestError(
            "Security check could not load. Please try again.",
            "captcha_failed",
          ),
        );
      };
      document.head.append(script);
    });
  if (!overlay.classList.contains("active"))
    throw new RequestError(
      "Security check was cancelled.",
      "captcha_cancelled",
    );
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (token?: string) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      provider.turnstile?.remove(widget);
      overlay.classList.remove("active");
      if (token) resolve(token);
      else
        reject(
          new RequestError(
            "Security check was cancelled.",
            "captcha_cancelled",
          ),
        );
    };
    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains("active")) finish();
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
    const widget = provider.turnstile!.render(target, {
      sitekey,
      callback: (token: string) => finish(token),
      "error-callback": () => finish(),
      "expired-callback": () => finish(),
    });
  });
}
export async function ensureGuest(): Promise<Session> {
  const backend = client();
  const old = backend ? (await backend.auth.getSession()).data.session : null;
  if (old) return old;
  if (!backend)
    throw new RequestError(
      "Online rankings are unavailable. You can still play local Classic or Levels.",
      "official_unavailable",
      503,
    );
  if (!guestRequest)
    guestRequest = (async () => {
      const token = await captcha();
      const { data, error } = await backend.auth.signInAnonymously({
        options: { captchaToken: token },
      });
      if (error || !data.session)
        throw new RequestError(
          "Could not create a guest session. Please retry.",
          "guest_unavailable",
          503,
        );
      return data.session;
    })().finally(() => {
      guestRequest = null;
    });
  return guestRequest;
}
export async function api<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    auth?: "required" | "optional" | "none";
  } = {},
): Promise<T> {
  const auth = options.auth || "required";
  const session =
    auth === "required"
      ? await ensureGuest()
      : auth === "optional"
        ? await existingSession()
        : null;
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new RequestError(
      "Connection interrupted. Your run is saved; please retry.",
      "connection_failed",
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new RequestError(
      "Official service is unavailable. Your run remains on this device.",
      "service_unavailable",
      503,
    );
  }
  if (!response.ok)
    throw new RequestError(
      String(data.message || data.error || "Request failed"),
      String(data.error || "request_failed"),
      response.status,
    );
  return data as T;
}
let selected: PilotEvent | null = null;
export function getSelectedEvent() {
  return selected;
}
export function selectEvent(event: PilotEvent) {
  selected = event;
  storage.set("bb_pilot_event", event.id);
}
export async function loadEvents() {
  const result = await api<{
    events: PilotEvent[];
    serverTime: string;
    claimsEnabled: boolean;
  }>("events", { auth: "none" });
  selected =
    result.events.find(
      (e) => e.id === (selected?.id || storage.get("bb_pilot_event")),
    ) ||
    result.events.find(
      (e) => Date.parse(e.ends_at) > Date.parse(result.serverTime),
    ) ||
    result.events[0] ||
    null;
  return result;
}
export function requestRun(input: {
  requestId: string;
  eventId?: string;
  kind: "tournament" | "levels";
  level?: number;
  nickname: string;
  adult: boolean;
}) {
  return api<RunSession>("session-token", { method: "POST", body: input });
}
export function submitTournamentScore(input: ReplaySubmission) {
  return api<ScoreReceipt>("submit-score", { method: "POST", body: input });
}
export function fetchLiveLeaderboard(eventId: string) {
  return api<{
    event: PilotEvent;
    tournament: Standing[];
    me: Standing | null;
    stars: { user_id: string; rank: number; nickname: string; stars: number }[];
    myStars: number;
    maxStars: number;
    serverTime: string;
  }>(`leaderboard?eventId=${encodeURIComponent(eventId)}`, {
    auth: "optional",
  });
}
export function fetchBalance() {
  return api<Balance>("check-referral-rewards");
}
export function fetchClaims() {
  return api<{ claims: ClaimStatus[] }>("claims");
}
export function requestClaim(eventId: string) {
  return api<{
    claimId: string;
    status: string;
    expiresAt: string;
    whatsappUrl: string;
  }>("claim", { method: "POST", body: { eventId, adult: true } });
}
