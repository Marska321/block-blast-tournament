import { dialog, text } from "./dialogs";
import { appendUpdatesLauncher } from "./updates";
import { offlineDescription } from "./offline";

// Prize UI stays closed unless explicitly enabled for a reviewed promotion release.
export const CASUAL_ONLY = import.meta.env.VITE_CASUAL_ONLY !== "false";
export const CLASSIC_RANKED_ENABLED = import.meta.env.VITE_CLASSIC_RANKED_ENABLED === "true";
const configuredChannel = String(import.meta.env.VITE_WHATSAPP_CHANNEL_URL || "").trim();
export const WHATSAPP_CHANNEL_URL = /^https:\/\/(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+\/?$/.test(configuredChannel)
  ? configuredChannel : null;

export function appendChannelFollow(parent: HTMLElement) {
  if (!WHATSAPP_CHANNEL_URL) return;
  const link = document.createElement("a");
  link.textContent = "Follow Playables on WhatsApp";
  link.className = "modal-button channel-follow";
  link.href = WHATSAPP_CHANNEL_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  parent.append(link, text("p", "Optional event announcements. In WhatsApp, tap Follow and turn on the notification bell to hear when events start."));
}

export function showCasualInfo() {
  const { card } = dialog("casualInfoModal", "Events & updates");
  card.append(text("p", "Blok Blaster is a block puzzle by Playables. Play instantly in your browser, with no download or forced ad breaks."));
  card.append(text("p", "Classic and all 60 Levels are free to play. Promotions are coming soon. Prize entry is closed until an event launches."));
  appendChannelFollow(card);
  appendUpdatesLauncher(card);
  card.append(text("p", "No account or phone number is needed to play. Your progress stays in this browser."));
  const offline = text("p", offlineDescription()); offline.setAttribute("data-offline-description", ""); card.append(offline);
  card.append(text("p", "Daily rankings, announcements and promotions need an internet connection."));
}
