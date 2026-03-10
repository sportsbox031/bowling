import assert from "node:assert/strict";
import {
  buildPublicTournamentAggregatePayload,
  buildPublicTournamentListAggregatePayload,
} from "../src/lib/aggregates/public-tournament.ts";

const payload = buildPublicTournamentAggregatePayload({
  tournamentId: "tour-1",
  tournament: {
    title: "테스트 대회",
    region: "서울",
  },
  divisions: [
    { id: "div-b", title: "B조", code: "B" },
    { id: "div-a", title: "A조", code: "A" },
  ],
  eventsByDivision: [
    {
      divisionId: "div-b",
      events: [
        { id: "e2", title: "2인조", kind: "DOUBLES", gameCount: 3, scheduleDate: "2026-03-12", laneStart: 1, laneEnd: 2, tableShift: 0 },
        { id: "e1", title: "개인전", kind: "SINGLE", gameCount: 6, scheduleDate: "2026-03-11", laneStart: 1, laneEnd: 2, tableShift: 0 },
      ],
    },
    {
      divisionId: "div-a",
      events: [
        { id: "e3", title: "5인조", kind: "FIVES", gameCount: 2, scheduleDate: "2026-03-13", laneStart: 3, laneEnd: 4, tableShift: 2 },
      ],
    },
  ],
});

assert.equal(payload.tournament.id, "tour-1");
assert.deepEqual(payload.divisions.map((division) => division.id), ["div-a", "div-b"]);
assert.deepEqual(
  payload.eventsByDivision.find((entry) => entry.divisionId === "div-b")?.events.map((event) => event.id),
  ["e1", "e2"],
);

const listPayload = buildPublicTournamentListAggregatePayload([
  { id: "tour-2", title: "2026 수원대회", region: "경기", seasonYear: 2026, startsAt: "2026-04-02" },
  { id: "tour-1", title: "2025 서울대회", region: "서울", seasonYear: 2025, startsAt: "2025-05-01" },
]);

assert.deepEqual(listPayload.items.map((item) => item.id), ["tour-2", "tour-1"]);
assert.equal(listPayload.items[0]?.title, "2026 수원대회");

console.log("public-tournament aggregate test passed");
