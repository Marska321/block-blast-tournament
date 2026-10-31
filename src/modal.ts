import { dialog, text } from "./dialogs";
import { chancesManager } from "./chances";
import { leaderboardManager } from "./leaderboard";
import { getSubmission, retrySubmission } from "./session";
import { CASUAL_ONLY, CLASSIC_RANKED_ENABLED, appendChannelFollow } from "./launch";
import { appendClassicSubmission, openClassicEntry } from "./classic";
export interface PerformanceStats {
  efficiencyGrade: string;
  strategicGrade: string;
  totalMoves: number;
  totalLines: number;
  maxCombo: number;
}
let restart = () => {};
let classic = () => {};
export function createGameOverModal(options: {
  onRestart: () => void;
  onGoToClassic: () => void;
}) {
  restart = options.onRestart;
  classic = options.onGoToClassic;
}
export function hideModal() {
  document.getElementById("gameOverModal")?.classList.remove("active");
}
export function showModal(
  score: number,
  modeName: string,
  perf?: PerformanceStats,
  rescue?: { onRevive: () => void; available: boolean; used: boolean },
  ranked?: { onFinish?: () => void },
) {
  const { card } = dialog("gameOverModal", "Run finished");
  const official = modeName.toLowerCase().includes("tournament");
  card.append(
    text(
      "p",
      official
        ? "Official run — subject to server acceptance"
        : ranked ? "Classic — daily ranked run · no prizes" : "Classic — casual record only",
    ),
    text("p", `${score.toLocaleString()} points`, "score-value"),
  );
  if (perf)
    card.append(
      text(
        "p",
        `${perf.totalMoves} moves · ${perf.totalLines} lines · Best combo ${perf.maxCombo}x`,
      ),
    );
  if (!official && rescue?.available) {
    const revive = text("button", "Free revive · 1 per run", "modal-button");
    revive.id = "classicReviveBtn";
    revive.onclick = () => { revive.setAttribute("disabled", ""); rescue.onRevive(); };
    card.append(revive, text("p", "Keep your board and score. Get fresh rescue pieces. No ad required."));
  } else if (!official && rescue?.used) {
    card.append(text("p", "Free revive used · no revives left this run."));
  }
  if (ranked) appendClassicSubmission(card, ranked.onFinish);
  const status = text("p", "");
  status.id = "submissionStatus";
  status.setAttribute("role", "status");
  card.append(status);
  const retry = text("button", "Retry saving this run", "modal-button");
  retry.onclick = () => void retrySubmission();
  card.append(retry);
  function render() {
    const submission = getSubmission();
    status.textContent = official
      ? submission
        ? `${submission.state}${submission.receipt ? ` · Accepted score ${submission.receipt.score.toLocaleString()} · Current rank #${submission.receipt.rank}` : ""}${submission.error ? ` — ${submission.error}` : ""}`
        : "This run has not been submitted."
      : ranked ? "Local copy saved on this device." : "Casual score saved on this device.";
    retry.hidden =
      !official || !submission || submission.state !== "retry needed";
  }
  render();
  const listener = () => {
    if (document.getElementById("submissionStatus") === status) render();
    else window.removeEventListener("pilot-submission", listener);
  };
  window.addEventListener("pilot-submission", listener);
  const again = text(
    "button",
    official
      ? `Next official attempt (${chancesManager.getChancesRemaining()} tickets cached)`
      : ranked ? "Play ranked Classic again" : "Play Classic again",
    "modal-button",
  );
  again.onclick = restart;
  const casual = text(
    "button",
    "Play Classic — free",
    "modal-secondary-button",
  );
  casual.onclick = classic;
  const standings = text(
    "button",
    CLASSIC_RANKED_ENABLED ? "Daily leaderboard & streak" : CASUAL_ONLY ? "View your progress" : "View accepted standings / prize claims",
    "modal-secondary-button",
  );
  if (!official && !ranked && CLASSIC_RANKED_ENABLED) {
    const join = text("button", "Try today's ranked Classic", "modal-secondary-button");
    join.onclick = () => { hideModal(); openClassicEntry(); };
    card.append(join);
  }
  standings.onclick = () => leaderboardManager.show();
  card.append(
    again,
    casual,
    standings,
    text(
      "p",
      CASUAL_ONLY ? "Progress is saved in this browser. Clearing browser data can erase it." : "Guest access is stored in this browser. Clearing browser data can lose access to runs and claims.",
    ),
  );
  if (CASUAL_ONLY) appendChannelFollow(card);
}
