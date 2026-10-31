import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
async function worker() {
  const listeners: Record<string, Function> = {}, notifications: any[] = [], opened: string[] = [], messages: any[] = [];
  let focused = 0;
  const self = { location: { origin: "https://game.test" }, addEventListener: (name: string, cb: Function) => listeners[name] = cb,
    registration: { showNotification: async (...args: any[]) => notifications.push(args) },
    clients: { matchAll: async () => [{ url: "https://game.test/", focus: async () => focused++, postMessage: (data: unknown) => messages.push(data) }],
      openWindow: async (url: string) => opened.push(url) } };
  runInNewContext(await readFile("public/notifications-sw.js", "utf8"), { self, URL, Date });
  async function event(name: string, data: any) { let done; listeners[name]({ ...data, waitUntil: (promise: Promise<unknown>) => done = promise }); await done; }
  return { event, notifications, opened, messages, focused: () => focused };
}
test("worker shows news safely, ignores expired promotions, and notification clicks preserve an existing run", async () => {
  const w = await worker();
  await w.event("push", { data: { json: () => ({ title: "News", message: "Hello", id: "same", path: "/?updates=1" }) } });
  assert.equal(w.notifications[0][0], "News"); assert.equal(w.notifications[0][1].tag, "playables-same");
  await w.event("push", { data: { json: () => ({ expiresAt: "2020-01-01" }) } }); assert.equal(w.notifications.length, 1);
  await w.event("push", { data: { json: () => { throw Error(); } } }); assert.equal(w.notifications[1][0], "Blok Blaster");
  await w.event("push", { data: { json: () => null } }); assert.equal(w.notifications[2][0], "Blok Blaster");
  for (const path of ["/?updates=1", "https://evil.test", "//evil.test", "/\\evil.test", "/api/claims"]) {
    await w.event("notificationclick", { notification: { close() {}, data: { path } } });
  }
  assert.equal(w.opened.length, 0); assert.equal(w.focused(), 5); assert.equal(w.messages.length, 5);
  assert.equal(w.messages[0].type, "OPEN_UPDATES");
});
