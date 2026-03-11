import assert from "node:assert/strict";
import { sortAssignmentsByPosition, withAssignmentPositions } from "../src/lib/assignment-position.ts";

const ordered = withAssignmentPositions([
  { playerId: "p2", gameNumber: 1, laneNumber: 1 },
  { playerId: "p1", gameNumber: 1, laneNumber: 1 },
  { playerId: "p3", gameNumber: 1, laneNumber: 2 },
]);

assert.deepEqual(
  ordered.map((item) => `${item.playerId}:${item.position}`),
  ["p2:1", "p1:2", "p3:1"],
  "manual save should assign lane-local positions from current array order",
);

const sorted = sortAssignmentsByPosition([
  { playerId: "p1", gameNumber: 1, laneNumber: 1, position: 2 },
  { playerId: "p3", gameNumber: 1, laneNumber: 2, position: 1 },
  { playerId: "p2", gameNumber: 1, laneNumber: 1, position: 1 },
]);

assert.deepEqual(
  sorted.map((item) => item.playerId),
  ["p2", "p1", "p3"],
  "reload should restore same-lane order from stored position",
);

console.log("assignment position test passed");
