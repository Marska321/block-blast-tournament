import { dialog, text } from "./dialogs";
import {
  existingSession,
  fetchClaims,
  fetchLiveLeaderboard,
  getSelectedEvent,
  loadEvents,
  requestClaim,
  selectEvent,
} from "./supabaseClient";
import { authManager } from "./auth";
import { storage } from "./storage";
import { levelProgress } from "./levels";
import { syncLevelProgress } from "./progressSync";
import { CASUAL_ONLY, CLASSIC_RANKED_ENABLED, appendChannelFollow } from "./launch";
import { showClassicBoard } from "./classic";
class LeaderboardManager {
  private modal: HTMLElement | null = null;
  getPlayerName() {
    return authManager.getProfile().nickname;
  }
  recordClassicScore(score: number) {
    const best = this.getClassicBestScore();
    if (score > best) storage.set("bb_pilot_classic_best", String(score));
  }
  getClassicBestScore() {
    const values = [
      storage.get("bb_pilot_classic_best"),
      storage.get("bbt_tourney_best_score"),
    ]
      .map(Number)
      .filter(Number.isFinite);
    return Math.max(0, ...values);
  }
  hide() {
    this.modal?.classList.remove("active");
  }
  show(tab: "tourney" | "stars" | "local" = "tourney") {
    if (CLASSIC_RANKED_ENABLED && tab !== "local" && (CASUAL_ONLY || tab === "tourney")) {
      showClassicBoard(() => this.show("local"));
      return;
    }
    if (CASUAL_ONLY) {
      const { overlay, card } = dialog("leaderboardModalOverlay", "Your progress");
      this.modal = overlay;
      card.append(
        text("p", `Classic best: ${this.getClassicBestScore().toLocaleString()} points`),
        text("p", `Adventure: ${levelProgress.getTotalStars()} / 180 stars`),
        text("p", "Saved on this device. Prize events are not open yet."),
      );
      appendChannelFollow(card);
      return;
    }
    const { overlay, card } = dialog(
      "leaderboardModalOverlay",
      tab === "stars" ? "Adventure stars" : "Tournament standings",
    );
    this.modal = overlay;
    const status = text("p", "Loading…");
    status.setAttribute("role", "status");
    card.append(status);
    const content = document.createElement("div");
    card.append(content);
    const tabs = document.createElement("div");
    for (const [label, value] of [
      ["Tournament", "tourney"],
      ["Adventure stars", "stars"],
    ] as const) {
      const b = text("button", label, "modal-secondary-button");
      b.onclick = () => this.show(value);
      tabs.append(b);
    }
    card.append(tabs);
    void (async () => {
      try {
        const result = await loadEvents();
        if (!result.events.length) {
          status.textContent =
            "No official events yet. Local adventure progress remains on this device.";
          return;
        }
        const selector = document.createElement("select");
        selector.setAttribute("aria-label", "Tournament event");
        for (const event of result.events) {
          const option = document.createElement("option");
          option.value = event.id;
          option.textContent = `${event.is_demo ? "DEMO — " : ""}${event.title}`;
          selector.append(option);
        }
        selector.value = getSelectedEvent()!.id;
        card.insertBefore(selector, status);
        const render = async () => {
          content.replaceChildren();
          status.textContent = "Loading…";
          const event = result.events.find((e) => e.id === selector.value)!;
          selectEvent(event);
          const data = await fetchLiveLeaderboard(event.id);
          status.textContent =
            tab === "stars"
              ? `On this device: ${levelProgress.getTotalStars()} / 180 stars. Global standings include replay-validated progress only.`
              : `${event.is_demo ? "DEMO — no real prizes. " : ""}${event.prize_pool}. ${Date.parse(data.serverTime) < Date.parse(event.ends_at) ? "Closes" : "Closed"} ${new Date(event.ends_at).toLocaleString()}. Standings are provisional.`;
          const list =
            tab === "stars"
              ? data.stars.map((r) => ({
                  id: r.user_id,
                  rank: r.rank,
                  name: r.nickname,
                  value: `${r.stars} / 180 stars`,
                }))
              : data.tournament.map((r) => ({
                  id: r.user_id,
                  rank: r.rank,
                  name: r.nickname,
                  value: `${r.score.toLocaleString()} pts`,
                }));
          const myId = (await existingSession())?.user.id;
          if (!list.length)
            content.append(text("p", "No accepted results yet."));
          for (const entry of list) {
            const row = text(
              "p",
              `#${entry.rank} ${entry.name}${entry.id === myId ? " (you)" : ""} — ${entry.value}`,
              "lb-safe-row",
            );
            content.append(row);
          }
          if (tab === "tourney")
            content.append(
              text(
                "p",
                data.me
                  ? `Your accepted best: ${data.me.score.toLocaleString()} · Rank #${data.me.rank}`
                  : "You have no accepted score in this event.",
              ),
            );
          if (tab === "stars") {
            const sync = text(
              "button",
              "Sync completed level replays",
              "modal-button",
            );
            sync.onclick = async () => {
              sync.setAttribute("disabled", "");
              try {
                await syncLevelProgress(true);
                await render();
              } catch (e) {
                status.textContent =
                  e instanceof Error ? e.message : "Sync failed";
              } finally {
                sync.removeAttribute("disabled");
              }
            };
            content.append(sync);
            return;
          }
          if (myId) {
            const claims = await fetchClaims();
            for (const claim of claims.claims.filter(
              (c) => c.event_id === event.id,
            ))
              content.append(
                text(
                  "p",
                  `Prize claim: ${claim.status}${claim.review_reason ? ` — ${claim.review_reason}` : ""}`,
                ),
              );
          }
          const closed =
            Date.parse(data.serverTime) >= Date.parse(event.ends_at);
          const within =
            Date.parse(data.serverTime) <
            Date.parse(event.ends_at) + 48 * 3600_000;
          if (
            data.me &&
            data.me.rank <= event.prize_slots &&
            closed &&
            within &&
            !event.is_demo &&
            result.claimsEnabled
          ) {
            const claim = text(
              "button",
              "Request manual prize review (18+)",
              "modal-button",
            );
            claim.onclick = async () => {
              claim.setAttribute("disabled", "");
              try {
                if (!authManager.isAdult())
                  throw new Error(
                    "Official prizes are for adults aged 18 or older.",
                  );
                const response = await requestClaim(event.id);
                const link = document.createElement("a");
                link.href = response.whatsappUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.className = "modal-button";
                link.textContent = "Open WhatsApp to send your claim";
                content.append(
                  link,
                  text(
                    "p",
                    `Pending manual review. Code expires ${new Date(response.expiresAt).toLocaleTimeString()}. Opening WhatsApp does not approve your claim.`,
                  ),
                );
              } catch (e) {
                status.textContent =
                  e instanceof Error ? e.message : "Could not request a claim.";
              } finally {
                claim.removeAttribute("disabled");
              }
            };
            content.append(claim);
          }
        };
        selector.onchange = () =>
          void render().catch((e) => {
            status.textContent = e.message;
          });
        await render();
      } catch (error) {
        status.textContent =
          error instanceof Error ? error.message : "Standings unavailable.";
      }
    })();
  }
}
export const leaderboardManager = new LeaderboardManager();
