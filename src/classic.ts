import type { GameAction } from "../shared/engine";
import type { ClassicBoard, ClassicPending, ClassicReceipt, ClassicSession } from "../shared/classic";
import { api, ensureGuest, RequestError } from "./supabaseClient";
import { dialog, text } from "./dialogs";
import { storage } from "./storage";
import { CLASSIC_RANKED_ENABLED } from "./launch";
import { classicDateLabel, downloadClassicCard } from "./classicCard";
import { classicDisplayEntries } from "./classicChallengers";
import "./classic.css";
import { requireConnection } from "./offline";

const pendingKey = "bb_classic_submission";
let pending: ClassicPending | null = null;
try {
  const value = JSON.parse(storage.get(pendingKey) || "null");
  if (value?.session?.id && Array.isArray(value.actions)) pending = value;
  if (pending?.state === "saving") pending.state = "retry needed";
} catch { /* Corrupt local data cannot establish a ranked result. */ }
let busy = false;
let startGame: ((nickname: string) => Promise<void>) | null = null;
export function configureClassicStart(start: (nickname: string) => Promise<void>) { startGame = start; }
export function getClassicSubmission() { return pending; }
export function hasPendingClassic() { return pending?.state === "saving" || pending?.state === "retry needed"; }
function publish() {
  if (pending) storage.set(pendingKey, JSON.stringify(pending));
  window.dispatchEvent(new Event("classic-submission"));
}
export async function requestClassicSession(nickname: string) {
  if (!navigator.onLine) throw new Error("Reconnect to start a ranked run. Classic and Levels are available offline.");
  if (!CLASSIC_RANKED_ENABLED) throw new Error("Daily rankings are not available yet.");
  if (hasPendingClassic()) throw new Error("Save your previous ranked run before starting another. Local play is always available.");
  const guest = await ensureGuest();
  let request: { id: string; user: string; nickname: string } | null = null;
  try { request = JSON.parse(storage.get("bb_classic_start") || "null"); } catch {}
  if (!request || request.user !== guest.user.id) {
    request = { id: crypto.randomUUID(), user: guest.user.id, nickname };
    if (!storage.set("bb_classic_start", JSON.stringify(request)))
      throw new Error("Ranked play needs browser storage to preserve your run. Local play is available.");
  }
  const session = await api<ClassicSession>("classic", {
    method: "POST", body: { operation: "start", requestId: request.id, nickname: request.nickname },
  });
  storage.set("bb_classic_joined", "true");
  storage.set("bbt_player_nickname", request.nickname);
  storage.remove("bb_classic_start");
  return session;
}
export function beginClassicSubmission(session: ClassicSession, actions: GameAction[]) {
  pending = { session, actions: structuredClone(actions), state: "saving" };
  publish();
  void retryClassicSubmission();
}
export async function retryClassicSubmission() {
  if (!pending || busy || pending.state === "accepted" || pending.state === "rejected") return;
  busy = true;
  pending.state = "saving";
  publish();
  try {
    pending.receipt = await api<ClassicReceipt>("classic", {
      method: "POST", body: { operation: "submit", sessionId: pending.session.id, actions: pending.actions },
    });
    pending.state = "accepted";
    pending.error = undefined;
  } catch (error) {
    pending.state = error instanceof RequestError && !error.retryable ? "rejected" : "retry needed";
    pending.error = error instanceof Error ? error.message : "Could not save your daily score.";
  } finally { busy = false; publish(); }
}
export function openClassicEntry() {
  if (!requireConnection()) return;
  if (!CLASSIC_RANKED_ENABLED) return;
  const { overlay, card } = dialog("classicEntry", "A little friendly competition.");
  card.classList.add("classic-daily-card");
  card.append(text("p", "Daily Classic · free entry · no prizes", "classic-eyebrow"));
  card.append(text("p", "Choose a public nickname for the leaderboard and shareable results. One free revive per run; unlimited new runs. Today's score must reach the server before midnight South Africa time."));
  card.append(text("p", "No email or phone number needed. A guest account is saved in this browser; clearing browser data can lose access to your rankings and streak."));
  const form = document.createElement("form");
  const label = text("label", "Your public nickname");
  label.setAttribute("for", "classicNickname");
  const input = document.createElement("input");
  input.id = "classicNickname"; input.required = true; input.maxLength = 24;
  input.setAttribute("autocomplete", "nickname"); input.className = "auth-input";
  input.value = storage.get("bbt_player_nickname") || "";
  const status = text("p", ""); status.setAttribute("role", "status");
  const submit = document.createElement("button"); submit.type = "submit";
  submit.className = "modal-button"; submit.textContent = "Start my ranked run";
  form.append(label, input, status, submit); card.append(form);
  if (hasPendingClassic()) appendClassicSubmission(card);
  form.onsubmit = async event => {
    event.preventDefault();
    const nickname = input.value.trim();
    if (!nickname || /[<>\u0000-\u001f\u007f]/.test(nickname)) { status.textContent = "Use a nickname without HTML."; return; }
    submit.disabled = true; status.textContent = "Preparing your ranked run…";
    try {
      if (!startGame) throw new Error("Please reload and try again.");
      await startGame(nickname);
      document.getElementById("classicBoard")?.classList.remove("active");
      overlay.classList.remove("active");
      requestAnimationFrame(() => document.getElementById("gameCanvas")?.focus({ preventScroll: true }));
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Could not start. Local play is available."; }
    finally { submit.disabled = false; }
  };
}
export function appendClassicSubmission(parent: HTMLElement, finish?: () => void) {
  const section = document.createElement("div"); section.className = "classic-submission";
  const status = text("p", ""); status.setAttribute("role", "status");
  const retry = text("button", "Retry saving daily score", "modal-secondary-button");
  retry.onclick = () => void retryClassicSubmission();
  const done = text("button", "Finish & save daily score", "modal-button");
  let decided = !finish;
  done.onclick = () => { decided = true; finish?.(); render(); };
  section.append(status, done, retry); parent.append(section);
  function render() {
    done.hidden = decided;
    retry.hidden = !decided || pending?.state !== "retry needed";
    if (!decided) { status.textContent = "Take your free revive, or finish now and save this score to today's board."; return; }
    status.textContent = pending ? pending.state === "accepted" && pending.receipt
      ? `Accepted · ${pending.receipt.score.toLocaleString()} points · Rank #${pending.receipt.rankAtAcceptance} when accepted. Open the daily board for your current rank.`
      : `${pending.state === "saving" ? "Saving daily score…" : pending.state}${pending.error ? " — " + pending.error : ""}`
      : "No daily score waiting to save.";
  }
  render();
  const listener = () => {
    if (section.isConnected) render();
    else window.removeEventListener("classic-submission", listener);
  };
  window.addEventListener("classic-submission", listener);
}
export function showClassicBoard(onLocalProgress?: () => void) {
  if (!requireConnection()) return;
  const { overlay, card } = dialog("classicBoard", "The daily board.");
  card.classList.add("classic-daily-card");
  card.append(text("p", "CLASSIC · A FRESH CHANCE EVERY DAY", "classic-eyebrow"));
  const controls = document.createElement("div"); controls.className = "classic-day-controls";
  const today = text("button", "Today", "modal-secondary-button");
  const yesterday = text("button", "Yesterday", "modal-secondary-button");
  const date = document.createElement("input"); date.type = "date"; date.setAttribute("aria-label", "Leaderboard day");
  controls.append(today, yesterday, date); card.append(controls);
  const status = text("p", "Loading today's scores…"); status.setAttribute("role", "status"); card.append(status);
  const content = document.createElement("div"); card.append(content);
  const start = text("button", "Play for today's board", "modal-button"); start.id = "classicRankedStart";
  start.onclick = openClassicEntry;
  const local = text("button", "Your local progress", "modal-secondary-button"); local.onclick = onLocalProgress || (() => {});
  local.hidden = !onLocalProgress;
  card.append(start, local, text("p", "Best accepted score per player · One free revive · No prizes. Scores must arrive before midnight South Africa time.", "classic-fine-print"));
  if (pending) appendClassicSubmission(card);
  let serial = 0, serverToday = "";
  const shift = (day: string, offset: number) => new Date(Date.parse(day + "T12:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
  const load = async (day?: string) => {
    const request = ++serial; status.textContent = "Loading scores…";
    try {
      const board = await api<ClassicBoard>(`classic${day ? "?day=" + encodeURIComponent(day) : ""}`, { auth: "optional" });
      if (request !== serial || !overlay.classList.contains("active")) return;
      serverToday = board.today; date.value = board.day; date.max = board.today; date.min = shift(board.today, -30);
      today.setAttribute("aria-pressed", String(board.day === board.today));
      yesterday.setAttribute("aria-pressed", String(board.day === shift(board.today, -1)));
      status.textContent = `${board.demo ? "TEST BOARD · " : ""}${classicDateLabel(board.day)} · ${board.closed ? "Final results" : "Closes at midnight SAST"} · ${board.participants} player${board.participants === 1 ? "" : "s"}`;
      content.replaceChildren();
      const hero = document.createElement("div"); hero.className = "classic-personal";
      hero.append(text("span", board.me ? "YOUR DAILY BEST" : "YOUR NEXT LITTLE CHALLENGE", "classic-eyebrow"));
      hero.append(text("strong", board.me ? `${board.me.score.toLocaleString()} pts · #${board.me.rank}` : "Make your mark."));
      hero.append(text("p", board.me ? board.me.pointsToNext
        ? `${board.me.pointsToNext.toLocaleString()} more points to pass the next player.` : "You're leading this board. Lekker!"
        : "Join with a nickname. Your local scores stay on this device."));
      content.append(hero);
      const streak = document.createElement("div"); streak.className = "classic-streak";
      streak.append(text("strong", `${board.streak.current}-day streak`), text("span", `Longest: ${board.streak.longest} ${board.streak.longest === 1 ? "day" : "days"}`));
      streak.append(text("p", board.streak.playedToday ? "Today is in the bag. See you tomorrow!" : "Finish a ranked game with 100+ points today to keep your streak."));
      const badges = document.createElement("div"); badges.className = "classic-badges";
      for (const [days, name] of [[3, "Spark"], [7, "On a roll"], [14, "Blazing"], [30, "Legend"]] as const) {
        const badge = text("span", `${days}d · ${name}`);
        const earned = board.streak.longest >= days;
        badge.className = earned ? "earned" : "";
        badge.setAttribute("aria-label", `${days}-day ${name} badge: ${earned ? "earned" : "not yet earned"}`);
        badges.append(badge);
      }
      streak.append(badges); content.append(streak);
      const displayEntries = classicDisplayEntries(board);
      const hasHouse = displayEntries.some(entry => entry.isHouse);
      const houseIntro = document.createElement("div");
      if (hasHouse) {
        houseIntro.append(text("h3", "Beat the house.", "classic-house-title"),
          text("p", "House challengers set the pace. Beat their scores; player ranks count real players only.", "classic-fine-print classic-house-note"));
      }
      const list = document.createElement("ol"); list.className = "classic-standings";
      list.setAttribute("aria-label", hasHouse ? "Daily Classic players and house score targets" : "Daily Classic standings");
      for (const entry of displayEntries) {
        const row = document.createElement("li"); row.className = entry.isMe ? "is-me" : "";
        row.dataset.house = String(entry.isHouse);
        const name = text("span", entry.nickname + (entry.isMe ? " (you)" : ""), "classic-nickname");
        if (entry.isHouse) name.append(text("span", "House", "classic-house-badge"));
        const rank = text("span", entry.isHouse ? "✦" : String(entry.rank).padStart(2, "0"), "classic-rank");
        rank.setAttribute("aria-label", entry.isHouse ? "House target" : `Player rank ${entry.rank}`);
        row.append(rank, name,
          text("strong", entry.score.toLocaleString()));
        list.append(row);
      }
      content.append(list);
      if (hasHouse) {
        content.insertBefore(houseIntro, hero);
        content.insertBefore(list, hero);
      }
      if (!board.entries.length) content.append(text("p", hasHouse
        ? "The house has set the targets. Be the first player on today's board."
        : "No accepted scores yet. There is room for your name here."));
      const download = text("button", board.closed ? "Download daily results card" : "Download live standings card", "modal-secondary-button");
      download.id = "classicResultsCard";
      download.onclick = async () => {
        download.setAttribute("disabled", "");
        try { await downloadClassicCard(board); status.textContent = "Image downloaded. You can post it in the Playables WhatsApp Channel yourself."; }
        catch (error) { status.textContent = error instanceof Error ? error.message : "Could not create the card."; }
        finally { download.removeAttribute("disabled"); }
      };
      content.append(download, text("p", board.closed ? "A finished day's scores, ready to share." :
        `${hasHouse ? "Cards include real players only. " : ""}Live snapshots are labelled as not final. Choose Yesterday for the finished day's results.`, "classic-fine-print"));
    } catch (error) {
      if (request === serial) status.textContent = error instanceof Error ? error.message : "Daily board unavailable. Local play is ready.";
    }
  };
  today.onclick = () => void load();
  yesterday.onclick = () => { if (serverToday) void load(shift(serverToday, -1)); };
  date.onchange = () => void load(date.value);
  const refresh = text("button", "Refresh board", "modal-secondary-button"); refresh.onclick = () => void load(date.value || undefined);
  controls.append(refresh);
  void load();
}
