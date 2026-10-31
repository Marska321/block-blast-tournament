import { dialog, text } from './dialogs';

let ready = false;
export function offlineDescription() {
  return ready
    ? 'Classic and Levels are saved for offline play on this device. Add the game to your Home Screen for easy access. Clearing browser data removes this copy.'
    : 'Open the game online to save Classic and Levels for offline play. If the copy is not ready after loading, close all game tabs and reopen online to finish installing. Rankings, announcements and promotions need a connection.';
}
export function requireConnection() {
  if (navigator.onLine) return true;
  const { card } = dialog('offlineInfo', 'Keep playing offline.');
  card.append(text('p', 'Classic and Levels are available. Reconnect to use daily rankings, notifications and promotions. Offline casual scores stay on this device and do not enter the daily leaderboard.'));
  return false;
}
export function initOffline() {
  const status = document.createElement('p');
  status.id = 'connection-status'; status.setAttribute('role', 'status');
  document.querySelector('.hud-mode-selector')?.after(status);
  function render() {
    status.hidden = navigator.onLine;
    status.textContent = 'Offline · Classic & Levels';
  }
  render();
  window.addEventListener('online', render); window.addEventListener('offline', render);
  if (!import.meta.env.PROD || !isSecureContext || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register('/notifications-sw.js', { scope: '/', updateViaCache: 'none' })
    .then(async () => {
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => channel.port1.close(), 5000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        ready = event.data?.ready === true;
        document.querySelectorAll('[data-offline-description]').forEach(el => { el.textContent = offlineDescription(); });
        channel.port1.close();
      };
      registration.active?.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
    }).catch(() => { /* Storage/private browsing restrictions must not block play. */ });
}
