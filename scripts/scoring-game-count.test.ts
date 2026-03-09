import assert from "node:assert/strict";
import { buildEventLeaderboard } from "../src/lib/scoring.ts";

const players = [
  {
    id: "p1",
    tournamentId: "t1",
    divisionId: "d1",
    group: "A",
    region: "수원",
    affiliation: "테스트학교",
    number: 1,
    name: "홍길동",
    hand: "right" as const,
    createdAt: "2026-03-10",
  },
];

const scores = [
  { id: "s1", tournamentId: "t1", eventId: "e1", playerId: "p1", gameNumber: 1, laneNumber: 1, score: 200, createdAt: "2026-03-10" },
  { id: "s2", tournamentId: "t1", eventId: "e1", playerId: "p1", gameNumber: 4, laneNumber: 1, score: 180, createdAt: "2026-03-10" },
  { id: "s3", tournamentId: "t1", eventId: "e1", playerId: "p1", gameNumber: 5, laneNumber: 1, score: 999, createdAt: "2026-03-10" },
];

const result = buildEventLeaderboard({ players, scores, gameCount: 4 });
assert.equal(result.rows[0].gameScores.length, 4);
assert.deepEqual(result.rows[0].gameScores.map((game) => game.score), [200, null, null, 180]);
assert.equal(result.rows[0].total, 380);
assert.equal(result.rows[0].attempts, 2);

console.log("scoring game-count tests passed");
