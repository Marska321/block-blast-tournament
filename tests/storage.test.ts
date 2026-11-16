import assert from "node:assert/strict";
import { test } from "node:test";
import { storage, isStorageHealthy } from "../src/storage";

test("quota failures remain visible until the affected save succeeds", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map<string, string>();
  let blocked = false;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (blocked) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key: string) => data.delete(key),
  } });
  try {
    assert.equal(storage.set("replay", "recoverable"), true);
    blocked = true;
    assert.equal(storage.set("replay", "new moves"), false);
    assert.equal(storage.get("replay"), "recoverable");
    blocked = false;
    storage.set("theme", "dark");
    assert.equal(isStorageHealthy("replay"), false);
    assert.equal(isStorageHealthy(), false);
    assert.equal(storage.set("replay", "new moves"), true);
    assert.equal(isStorageHealthy(), true);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
