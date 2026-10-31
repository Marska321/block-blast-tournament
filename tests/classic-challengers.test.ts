import test from "node:test";
import assert from "node:assert/strict";
import { classicDisplayEntries } from "../src/classicChallengers";
import type { ClassicStanding } from "../shared/classic";

const player = (rank: number, score: number): ClassicStanding => ({
  rank, score, nickname: `Player ${rank}`, isMe: rank === 2, pointsToNext: null,
});

test("house targets fill an empty live board without becoming ranked players", () => {
  const rows = classicDisplayEntries({ entries: [], participants: 0, closed: false });
  assert.equal(rows.length, 6);
  assert.ok(rows.every(row => row.isHouse && row.rank === null && !row.isMe));
  assert.ok(rows[0].score > 10000 && rows.at(-1)!.score < 200);
});

test("real scores move house targets down while preserving real ranks, identity and tie priority", () => {
  const entries = [player(1, 13000), player(2, 3420), player(3, 100)];
  const before = structuredClone(entries);
  const rows = classicDisplayEntries({ entries, participants: 3, closed: false });
  assert.equal(rows[0].nickname, "Player 1");
  assert.equal(rows.findIndex(row => row.nickname === "Captain Combo"), 1);
  assert.ok(rows.findIndex(row => row.nickname === "Player 2") < rows.findIndex(row => row.nickname === "Lekker Lines"));
  assert.deepEqual(rows.filter(row => !row.isHouse).map(row => row.rank), [1, 2, 3]);
  assert.equal(rows.find(row => row.isMe)?.rank, 2);
  assert.deepEqual(entries, before);
});

test("house targets retire at 50 real daily participants and never enter closed results", () => {
  const entries = [player(1, 1000)];
  for (const participants of [0, 1, 49])
    assert.equal(classicDisplayEntries({ entries, participants, closed: false }).filter(row => row.isHouse).length, 6);
  for (const participants of [50, 51, 100])
    assert.equal(classicDisplayEntries({ entries, participants, closed: false }).filter(row => row.isHouse).length, 0);
  assert.equal(classicDisplayEntries({ entries, participants: 1, closed: true }).length, 1);
  assert.deepEqual(classicDisplayEntries({ entries: [], participants: 0, closed: true }), []);
});
