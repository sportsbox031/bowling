import assert from "node:assert/strict";
import {
  cloneFivesEventData,
} from "../src/lib/fives-link.ts";

const cloned = cloneFivesEventData({
  sourceParticipants: [
    { id: "p1", playerId: "p1", squadId: "sq-a" },
    { id: "p2", playerId: "p2", squadId: "sq-b" },
  ],
  sourceSquads: [
    { id: "sq-a", name: "A조", createdAt: "2026-03-10T09:00:00.000Z" },
    { id: "sq-b", name: "B조", createdAt: "2026-03-10T09:01:00.000Z" },
  ],
  sourceTeams: [
    {
      id: "team-1",
      tournamentId: "t1",
      divisionId: "d1",
      eventId: "first-half-id",
      name: "테스트A",
      teamType: "NORMAL",
      memberIds: ["p1"],
      rosterIds: ["p1", "p2"],
      createdAt: "2026-03-10T09:05:00.000Z",
      updatedAt: "2026-03-10T09:05:00.000Z",
      linkedTeamId: "old-linked",
    },
  ],
  sourceAssignments: [
    { id: "p1_1", playerId: "p1", gameNumber: 1, laneNumber: 3, squadId: "sq-a" },
    { id: "p1_2", playerId: "p1", gameNumber: 2, laneNumber: 5, squadId: "sq-a" },
    { id: "p2_1", playerId: "p2", gameNumber: 1, laneNumber: 4, squadId: "sq-b" },
  ],
  sourceGameCount: 2,
  targetMeta: {
    tournamentId: "t1",
    divisionId: "d1",
    eventId: "second-half-id",
  },
  targetGameCount: 3,
  targetLaneRange: { start: 1, end: 10 },
  targetTableShift: 2,
  now: "2026-03-10T12:00:00.000Z",
  createSquadId: (sourceId) => `${sourceId}-copied`,
  createTeamId: (sourceId) => `${sourceId}-copied`,
});

assert.deepEqual(
  cloned.participants.map((item) => item.data),
  [
    { playerId: "p1", squadId: "sq-a-copied", createdAt: "2026-03-10T12:00:00.000Z" },
    { playerId: "p2", squadId: "sq-b-copied", createdAt: "2026-03-10T12:00:00.000Z" },
  ],
);
assert.deepEqual(
  cloned.squads.map((item) => item.data),
  [
    { name: "A조", createdAt: "2026-03-10T09:00:00.000Z" },
    { name: "B조", createdAt: "2026-03-10T09:01:00.000Z" },
  ],
);
assert.deepEqual(cloned.teams[0], {
  id: "team-1-copied",
  data: {
    tournamentId: "t1",
    divisionId: "d1",
    eventId: "second-half-id",
    name: "테스트A",
    teamType: "NORMAL",
    memberIds: ["p1"],
    rosterIds: ["p1", "p2"],
    linkedTeamId: "team-1",
    createdAt: "2026-03-10T09:05:00.000Z",
    updatedAt: "2026-03-10T12:00:00.000Z",
  },
});
assert.deepEqual(cloned.assignments, [
  {
    id: "p1_1",
    data: { playerId: "p1", gameNumber: 1, laneNumber: 7, squadId: "sq-a-copied", updatedAt: "2026-03-10T12:00:00.000Z" },
  },
  {
    id: "p1_2",
    data: { playerId: "p1", gameNumber: 2, laneNumber: 9, squadId: "sq-a-copied", updatedAt: "2026-03-10T12:00:00.000Z" },
  },
  {
    id: "p1_3",
    data: { playerId: "p1", gameNumber: 3, laneNumber: 1, squadId: "sq-a-copied", updatedAt: "2026-03-10T12:00:00.000Z" },
  },
]);

console.log("fives-link tests passed");
