import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the extension; production uses bundler resolution.
// @ts-expect-error TS5097
import { getPinnedEntry, rankEntries } from "./leaderboard-ranking.ts";

interface Entry {
  id: string;
  points: number;
}

const entries: Entry[] = [
  { id: "a", points: 100 },
  { id: "b", points: 80 },
  { id: "c", points: 80 },
  { id: "d", points: 0 },
];

const score = (entry: Entry) => entry.points;

test("rankEntries gives equal scores the same competition rank", () => {
  assert.deepEqual(
    rankEntries(entries, score).map(({ entry, rank }) => [entry.id, rank]),
    [
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ]
  );
});

test("getPinnedEntry returns a hidden zero-point user and the next distinct score", () => {
  const ranked = rankEntries(entries, score);
  const pinned = getPinnedEntry(ranked, ranked.slice(0, 3), (entry) => entry.id === "d", score);

  assert.equal(pinned?.entry.id, "d");
  assert.equal(pinned?.rank, 4);
  assert.equal(pinned?.pointsBehind, 80);
  assert.equal(pinned?.nextRank, 2);
});

test("getPinnedEntry does not pin an entry already visible", () => {
  const ranked = rankEntries(entries, score);

  assert.equal(
    getPinnedEntry(ranked, ranked.slice(0, 3), (entry) => entry.id === "c", score),
    null
  );
});

test("getPinnedEntry compares a tied user with the next strictly higher score", () => {
  const ranked = rankEntries(entries, score);
  const pinned = getPinnedEntry(ranked, ranked.slice(0, 1), (entry) => entry.id === "c", score);

  assert.equal(pinned?.rank, 2);
  assert.equal(pinned?.pointsBehind, 20);
  assert.equal(pinned?.nextRank, 1);
});
