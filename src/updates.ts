import { dialog, text } from "./dialogs";
import { announcementPath, type Announcement } from "../shared/updates";
import "./updates.css";
import { requireConnection } from "./offline";

const endpoint = "/api/events?channel=updates";
const tokenKey = "bb_push_management_token", savedKey = "bb_push_registered";
function stored(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function standalone() { return matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone; }
function supported() { return isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
async function request<T>(input?: object): Promise<T> {
  const response = await fetch(endpoint, { method: input ? "POST" : "GET", credentials: "same-origin",
    headers: input ? { "Content-Type": "application/json" } : {}, body: input ? JSON.stringify(input) : undefined,
    signal: AbortSignal.timeout(12000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Could not connect. Please try again.");
  return result as T;
}
async function registration() {
  await navigator.serviceWorker.register("/notifications-sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}
function managementToken() {
  let token = stored(tokenKey);
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(tokenKey, token);
  }
  return token;
}
function applicationKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
export function appendUpdatesLauncher(parent: HTMLElement) {
  const button = text("button", "Announcements & notifications ↗", "modal-secondary-button updates-launcher");
  button.setAttribute("type", "button"); button.onclick = () => void showUpdates(); parent.append(button);
}
export async function showUpdates() {
  if (!requireConnection()) return;
  const { card } = dialog("updatesModal", "A little news."); card.classList.add("updates-card");
  card.append(text("p", "Promotions, new features and upcoming events from Playables.", "updates-intro"));
  const section = document.createElement("section"); section.className = "updates-permission";
  section.append(text("h3", "Hear it here first."), text("p", "Optional browser alerts. No account or phone number needed. You can turn them off here at any time."));
  const status = text("p", "Checking notification settings…", "updates-status");
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  const enable = text("button", "Enable notifications", "modal-button") as HTMLButtonElement;
  const disable = text("button", "Turn off notifications", "modal-secondary-button") as HTMLButtonElement;
  enable.disabled = true; disable.hidden = true; section.append(status, enable, disable);
  const feed = document.createElement("section"); feed.className = "updates-feed";
  feed.setAttribute("aria-label", "Announcements"); feed.append(text("p", "Loading announcements…"));
  card.append(section, text("h3", "What’s new"), feed);
  let publicKey: string | null = null, busy = false;
  function renderSettings() {
    enable.hidden = false; enable.disabled = busy || !publicKey;
    disable.hidden = !stored(tokenKey) && !stored(savedKey); disable.disabled = busy;
    if (isIOS() && !standalone()) {
      status.textContent = "On iPhone or iPad, open the browser’s Share menu, choose Add to Home Screen, then open Blok Blaster from that icon to enable alerts. Requires iOS 16.4 or later."; enable.hidden = true;
    } else if (!supported()) {
      status.textContent = "This browser doesn’t support notification alerts. You can still read every announcement here."; enable.hidden = true;
    } else if (Notification.permission === "denied") {
      status.textContent = "Notifications are blocked in your browser or device settings. Allow them there, then reopen this panel."; enable.hidden = true;
    } else if (stored(savedKey) && Notification.permission === "granted") {
      status.textContent = "Notifications are on for this browser. Promotions and event updates will appear here and on your device."; enable.hidden = true;
    } else status.textContent = publicKey ? "Choose Enable notifications, then Allow in your browser’s prompt." : "Browser alerts aren’t available right now. Announcements are still available below.";
  }
  enable.onclick = () => {
    if (busy || !publicKey || !supported()) return;
    // Safari requires the permission request to start within the click gesture.
    const permission = Notification.requestPermission();
    busy = true; renderSettings(); status.textContent = "Waiting for notification permission…";
    void (async () => {
      try {
        if (await permission !== "granted") { busy = false; renderSettings(); return; }
        const hadToken = !!stored(tokenKey), token = managementToken();
        const reg = await registration(); let sub = await reg.pushManager.getSubscription();
        if (sub && !hadToken) { await sub.unsubscribe(); sub = null; }
        sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey!) });
        await request({ operation: "subscribe", token, subscription: sub.toJSON() });
        localStorage.setItem(savedKey, "true"); busy = false; renderSettings();
      } catch {
        busy = false; renderSettings(); enable.hidden = false;
        status.textContent = "Alerts could not be enabled. Check your connection and browser settings, then try again.";
      }
    })();
  };
  disable.onclick = () => {
    if (busy) return;
    busy = true; renderSettings(); status.textContent = "Turning off notifications…";
    void (async () => {
      let deviceOff = false;
      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration("/"); const sub = await reg?.pushManager.getSubscription();
          if (sub && !(await sub.unsubscribe()) && await reg?.pushManager.getSubscription())
            throw new Error("Device subscription could not be removed");
        }
        deviceOff = true; try { localStorage.removeItem(savedKey); } catch {}
        const token = stored(tokenKey); if (token) await request({ operation: "unsubscribe", token });
        localStorage.removeItem(tokenKey); busy = false; renderSettings();
        status.textContent = "Notifications are off for this browser. You can still read announcements below.";
      } catch {
        busy = false; renderSettings();
        status.textContent = deviceOff ? "Device alerts are off. Reconnect and tap Turn off notifications again to finish removing your subscription." : "Could not turn off notifications. Please try again or block them in browser settings.";
      }
    })();
  };
  const load = async () => {
    feed.replaceChildren(text("p", "Loading announcements…"));
    try {
      const result = await request<{ publicKey: string | null; announcements: Announcement[] }>(); publicKey = result.publicKey;
      if (supported()) {
        try {
          const reg = await navigator.serviceWorker.getRegistration("/"); const sub = await reg?.pushManager.getSubscription();
          if (!sub) localStorage.removeItem(savedKey);
        } catch { /* Device restrictions must not prevent reading announcements. */ }
      }
      renderSettings(); feed.replaceChildren();
      if (!result.announcements.length) {
        feed.append(text("h4", "Promotions · coming soon"), text("p", "No promotion is open right now. Enable notifications to hear when one launches. Classic and Levels are ready to play.", "updates-empty"));
      }
      for (const item of result.announcements) {
        const article = document.createElement("article"); article.className = "updates-item";
        const date = text("time", new Date(item.publish_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" }));
        date.setAttribute("datetime", item.publish_at); article.append(date, text("h4", item.title), text("p", item.message));
        try {
          const path = announcementPath(item.path);
          if (path !== "/?updates=1") { const link = text("a", "Take a look ↗") as HTMLAnchorElement; link.href = path; article.append(link); }
        } catch { /* Invalid links never leave the game. */ }
        feed.append(article);
      }
    } catch {
      renderSettings(); feed.replaceChildren(text("p", "Couldn’t load announcements. Check your connection and try again."));
      const retry = text("button", "Try again", "modal-secondary-button"); retry.onclick = () => void load(); feed.append(retry);
    }
  };
  await load();
}
export function initUpdates() {
  document.getElementById("updates-btn")?.addEventListener("click", () => void showUpdates());
  navigator.serviceWorker?.addEventListener("message", event => {
    if (event.origin === location.origin && event.data?.type === "OPEN_UPDATES") void showUpdates();
  });
  if (new URLSearchParams(location.search).get("updates") === "1") void showUpdates();
}
