import { dialog, text } from "./dialogs";
import { loadEvents, selectEvent, existingSession } from "./supabaseClient";
import { chancesManager } from "./chances";
import { authManager } from "./auth";
import { tournamentConfigManager } from "./tournamentConfig";
import { showTourneyRulesModal } from "./tourneyRulesModal";
export interface PreTourneyModalOptions {
  chancesRemaining: number;
  onStartOfficial: () => void;
  onGoToClassic: () => void;
  onInviteWhatsApp: () => void;
  onClose: () => void;
}
export function createPreTourneyModal() {}
export function hidePreTourneyModal() {
  document.getElementById("preTourneyModal")?.classList.remove("active");
}
export function showPreTourneyModal(options: PreTourneyModalOptions) {
  const { overlay, card } = dialog("preTourneyModal", "Official tournaments");
  card.append(
    text(
      "p",
      "Official prizes are 18+. Standings are provisional until manual winner review.",
    ),
  );
  const info = text("p", "Loading available events…");
  info.setAttribute("role", "status");
  card.append(info);
  const eventsBox = document.createElement("div");
  card.append(eventsBox);
  const profile = text(
    "button",
    "Choose nickname / age eligibility",
    "modal-button",
  );
  profile.onclick = () => authManager.show();
  card.append(profile);
  const start = text("button", "Start official run", "modal-button");
  start.id = "startOfficialRunBtn";
  start.setAttribute("disabled", "");
  card.append(start);
  start.onclick = () => {
    if (!authManager.isAdult()) {
      authManager.show(() => {
        if (authManager.isAdult()) {
          overlay.classList.remove("active");
          options.onStartOfficial();
        }
      });
      return;
    }
    overlay.classList.remove("active");
    options.onStartOfficial();
  };
  const casual = text(
    "button",
    "Play Classic — free and unlimited",
    "modal-secondary-button",
  );
  casual.onclick = () => {
    hidePreTourneyModal();
    options.onGoToClassic();
  };
  card.append(casual);
  const rules = text(
    "button",
    "Official rules and prize claims",
    "tourney-terms-link",
  );
  rules.onclick = showTourneyRulesModal;
  card.append(rules);
  const invite = text(
    "button",
    "Invite a friend — account-based bonus limits apply",
    "modal-secondary-button",
  );
  invite.onclick = options.onInviteWhatsApp;
  card.append(invite);
  void (async () => {
    try {
      const data = await loadEvents();
      const eligible = data.events.filter(
        (e) =>
          e.state === "open" &&
          Date.parse(e.starts_at) <= Date.parse(data.serverTime) &&
          Date.parse(e.ends_at) > Date.parse(data.serverTime),
      );
      if (!eligible.length) {
        info.textContent =
          "No official event is open yet. Classic and Levels are available.";
        return;
      }
      const label = text("label", "Select event");
      label.setAttribute("for", "pilotEventSelect");
      const selector = document.createElement("select");
      selector.id = "pilotEventSelect";
      const details = text("p", "");
      eventsBox.append(label, selector, details);
      for (const event of eligible) {
        const option = document.createElement("option");
        option.value = event.id;
        option.textContent = `${event.is_demo ? "DEMO — " : ""}${event.title} · ${event.prize_pool}`;
        selector.append(option);
      }
      function choose() {
        const event = eligible.find((e) => e.id === selector.value)!;
        selectEvent(event);
        details.textContent = `${event.is_demo ? "Demo only; no real prizes. " : ""}Closes ${new Date(event.ends_at).toLocaleString()}. ${event.prize_tiers.map((t) => `${t.rank}: ${t.reward}`).join(" · ")}`;
        tournamentConfigManager.updateConfig({
          tournamentTitle: event.title,
          totalPrizePool: event.prize_pool,
          sponsorName: "Pilot",
          prizeTiers: event.prize_tiers,
        });
      }
      selector.onchange = choose;
      choose();
      start.removeAttribute("disabled");
      info.textContent =
        "3 base tickets per account each day, plus up to 2 qualifying referral bonuses. Resets at midnight South Africa time.";
      if (await existingSession()) {
        const left = await chancesManager.refresh();
        info.textContent = `${left} tickets available today. Resets at midnight South Africa time.`;
      }
    } catch (error) {
      info.textContent =
        error instanceof Error
          ? error.message
          : "Official play is unavailable.";
    }
  })();
}
