import assert from "node:assert/strict";
import { reorderAssignmentsWithinLane } from "../src/lib/lane-reorder.ts";

type Assignment = {
  id: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
};

const assignments: Assignment[] = [
  { id: "a_1_1", playerId: "a", gameNumber: 1, laneNumber: 1 },
  { id: "b_1_1", playerId: "b", gameNumber: 1, laneNumber: 1 },
  { id: "c_1_1", playerId: "c", gameNumber: 1, laneNumber: 2 },
];

const reordered = reorderAssignmentsWithinLane(assignments, {
  gameNumber: 1,
  laneNumber: 1,
  draggedPlayerId: "a",
  targetPlayerId: "b",
});

assert.deepEqual(
  reordered.map((item) => `${item.playerId}:${item.laneNumber}`),
  ["b:1", "a:1", "c:2"],
  "same-lane drop should swap array order without changing lane numbers"
);

assert.deepEqual(
  reordered.map((item) => item.id),
  ["b_1_1", "a_1_1", "c_1_1"],
  "reordered assignments should keep ids aligned with each player record"
);

console.log("lane reorder test passed");
