import assert from "node:assert/strict";
import {
  applyScoreToEventRows,
  markRankRefreshComplete,
  markRankRefreshPending,
} from "../src/lib/scoreboard-rank-state.ts";

type ScoreColumn = { gameNumber: number; score: number | null };
type EventRow = {
  playerId: string;
  gameScores: ScoreColumn[];
};

const baseRows: EventRow[] = [
  {
    playerId: "p1",
    gameScores: [
      { gameNumber: 1, score: null },
      { gameNumber: 2, score: 180 },
    ],
  },
  {
    playerId: "p2",
    gameScores: [
      { gameNumber: 1, score: 150 },
      { gameNumber: 2, score: null },
    ],
  },
];

const updatedRows = applyScoreToEventRows(baseRows, {
  playerId: "p1",
  gameNumber: 1,
  score: 211,
});

assert.deepEqual(
  updatedRows[0].gameScores.map((column) => column.score),
  [211, 180],
  "score save should update the matching player's local row without refetching rankings",
);
assert.deepEqual(
  updatedRows[1].gameScores.map((column) => column.score),
  [150, null],
  "score save should not change other players",
);

const pendingEvent = markRankRefreshPending({
  id: "event-1",
  rankRefreshPending: false,
  rankRefreshedAt: "2026-03-11T09:00:00.000Z",
});

assert.equal(pendingEvent.rankRefreshPending, true);
assert.equal(pendingEvent.rankRefreshedAt, "2026-03-11T09:00:00.000Z");

const refreshedEvent = markRankRefreshComplete(pendingEvent, "2026-03-11T09:05:00.000Z");

assert.equal(refreshedEvent.rankRefreshPending, false);
assert.equal(refreshedEvent.rankRefreshedAt, "2026-03-11T09:05:00.000Z");

console.log("rank refresh state test passed");
