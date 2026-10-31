import type { GameAction, GameOptions } from "../shared/engine";
import { api, ensureGuest, existingSession } from "./supabaseClient";
import { authManager } from "./auth";
import { storage } from "./storage";
import { referralManager } from "./referral";
import { CASUAL_ONLY } from "./launch";
interface Entry {
  requestId: string;
  options: GameOptions;
  actions: GameAction[];
}
const key = "bb_pilot_progress_queue";
function queue(): Entry[] {
  try {
    return JSON.parse(storage.get(key) || "[]");
  } catch {
    return [];
  }
}
export function queueLevelProgress(
  options: GameOptions,
  actions: GameAction[],
) {
  if (CASUAL_ONLY) return;
  const entries = queue();
  entries.push({
    requestId: crypto.randomUUID(),
    options,
    actions: structuredClone(actions),
  });
  storage.set(key, JSON.stringify(entries));
  void syncLevelProgress().catch(() => {
    /* Preserve pending replays until a deliberate retry. */
  });
}
let syncing = false;
export async function syncLevelProgress(interactive = false) {
  if (CASUAL_ONLY) return;
  if (syncing) return;
  if (!queue().length) return;
  if (interactive) await ensureGuest();
  else if (!(await existingSession())) return;
  syncing = true;
  try {
    await api("profile", {
      method: "POST",
      body: {
        nickname: authManager.getProfile().nickname,
        adult: authManager.isAdult(),
      },
    });
    await referralManager.attribute();
    const entries = queue().sort((a, b) => a.options.level! - b.options.level!);
    for (const entry of entries) {
      await api("submit-progress", {
        method: "POST",
        body: {
          requestId: entry.requestId,
          level: entry.options.level,
          seed: entry.options.seed,
          actions: entry.actions,
          nickname: authManager.getProfile().nickname,
        },
      });
      storage.set(
        key,
        JSON.stringify(queue().filter((e) => e.requestId !== entry.requestId)),
      );
    }
  } finally {
    syncing = false;
  }
}
