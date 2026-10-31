import type { RunSession, ScoreReceipt } from "../shared/contracts";
import type { GameAction } from "../shared/engine";
import { submitTournamentScore, RequestError } from "./supabaseClient";
import { storage } from "./storage";
import { dialog, text } from "./dialogs";
export type SubmissionState =
  "saving" | "accepted" | "retry needed" | "rejected";
export interface PendingSubmission {
  session: RunSession;
  actions: GameAction[];
  state: SubmissionState;
  receipt?: ScoreReceipt;
  error?: string;
}
let current: PendingSubmission | null = null;
try {
  const raw = storage.get("bb_pilot_submission");
  if (raw) current = JSON.parse(raw);
  if (current?.state === "saving") current.state = "retry needed";
} catch {
  storage.remove("bb_pilot_submission");
}
let busy = false;
function publish() {
  if (current) storage.set("bb_pilot_submission", JSON.stringify(current));
  window.dispatchEvent(new Event("pilot-submission"));
}
export function getSubmission() {
  return current;
}
export function hasUnsavedSubmission() {
  return current?.state === "saving" || current?.state === "retry needed";
}
export function showPendingSubmission() {
  const { card } = dialog(
    "pendingSubmission",
    "Your previous official run needs saving",
  );
  const status = text(
    "p",
    "Your replay is kept on this device. Save it before spending another tournament ticket.",
  );
  status.setAttribute("role", "status");
  card.append(status);
  const retry = text("button", "Retry saving the previous run", "modal-button");
  retry.onclick = async () => {
    retry.setAttribute("disabled", "");
    await retrySubmission();
    status.textContent =
      current?.state === "accepted"
        ? "Score accepted. You can close this dialog and start your next run."
        : `${current?.state}: ${current?.error || ""}`;
    retry.removeAttribute("disabled");
  };
  card.append(retry);
}
export function beginSubmission(session: RunSession, actions: GameAction[]) {
  current = { session, actions: structuredClone(actions), state: "saving" };
  publish();
  void retrySubmission();
}
export async function retrySubmission() {
  if (!current || busy || current.state === "accepted") return;
  busy = true;
  current.state = "saving";
  publish();
  try {
    current.receipt = await submitTournamentScore({
      sessionId: current.session.id,
      actions: current.actions,
    });
    current.state = "accepted";
    current.error = undefined;
  } catch (error) {
    current.state =
      error instanceof RequestError && !error.retryable
        ? "rejected"
        : "retry needed";
    current.error =
      error instanceof Error ? error.message : "Could not save your score.";
  } finally {
    busy = false;
    publish();
  }
}
