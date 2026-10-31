import assert from "node:assert/strict";
import test from "node:test";
import { askClaimPhone, normalizeClaimPhone } from "../scripts/claim-input.js";

test("operator phone formatting retains one canonical duplicate-check identity", () => {
  for (const value of ["+12025550123", "+1 (202) 555-0123", "001 202 555 0123"])
    assert.equal(normalizeClaimPhone(value), "+12025550123");
  for (const value of ["", "02025550123", "2025550123", "+1not-a-number", "+123", "+1234567890123456"])
    assert.equal(normalizeClaimPhone(value), null);
});

test("invalid operator contact input is explained and retried before submitting a review", async () => {
  const answers = ["02025550123", "+1 (202) 555-0123"];
  const prompts: string[] = [], explanations: string[] = [];
  const phone = await askClaimPhone(async (prompt) => {
    prompts.push(prompt);
    return answers.shift()!;
  }, (message) => explanations.push(message));
  assert.equal(phone, "+12025550123");
  assert.equal(prompts.length, 2);
  assert.equal(explanations.length, 1);
  assert.match(explanations[0], /country code/);
  assert.ok(!explanations[0].includes("02025550123"));
});
