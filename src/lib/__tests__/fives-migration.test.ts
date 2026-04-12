import { mergeLegacyFivesEvents, mergeLegacyFivesTeams } from "@/lib/fives-migration";

describe("mergeLegacyFivesEvents", () => {
  it("matches first-half and second-half teams by overlap and normalized name", () => {
    const mergedTeams = mergeLegacyFivesTeams({
      firstTeams: [
        {
          id: "team-first",
          name: "수원유스A",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p5"],
          rosterIds: ["p1", "p2", "p3", "p4", "p5"],
        },
      ],
      secondTeams: [
        {
          id: "team-second",
          name: "수원유스",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p6"],
          rosterIds: ["p1", "p2", "p3", "p4", "p6"],
        },
      ],
      now: "2026-03-24T10:00:00.000Z",
    });

    expect(mergedTeams).toEqual([
      {
        id: "team-first",
        data: {
          name: "수원유스",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p5"],
          rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
          firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
          secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
          createdAt: "2026-03-24T10:00:00.000Z",
          updatedAt: "2026-03-24T10:00:00.000Z",
        },
      },
    ]);
  });

  it("merges first/second half events into one single-event fives shape", () => {
    const merged = mergeLegacyFivesEvents({
      firstEvent: {
        id: "evt-first",
        title: "5인조",
        kind: "FIVES",
        gameCount: 2,
        scheduleDate: "2026-03-24",
        laneStart: 1,
        laneEnd: 10,
        tableShift: 2,
      },
      secondEvent: {
        id: "evt-second",
        title: "5인조",
        kind: "FIVES",
        gameCount: 2,
        scheduleDate: "2026-03-24",
        laneStart: 1,
        laneEnd: 10,
        tableShift: 2,
      },
      firstParticipants: [
        { id: "p1", playerId: "p1", squadId: "sq1" },
        { id: "p2", playerId: "p2", squadId: "sq1" },
      ],
      secondParticipants: [
        { id: "p1", playerId: "p1", squadId: "sq1" },
        { id: "p6", playerId: "p6", squadId: "sq1" },
      ],
      firstSquads: [{ id: "sq1", name: "1조" }],
      secondSquads: [{ id: "sq1-other", name: "1조" }],
      firstTeams: [
        {
          id: "team-a",
          name: "A팀",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p5"],
          rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
        },
      ],
      secondTeams: [
        {
          id: "team-b",
          name: "A팀",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p6"],
          rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
          linkedTeamId: "team-a",
        },
      ],
      firstAssignments: [
        { playerId: "p1", gameNumber: 1, laneNumber: 3, squadId: "sq1" },
        { playerId: "p1", gameNumber: 2, laneNumber: 5, squadId: "sq1" },
      ],
      secondAssignments: [
        { playerId: "p1", gameNumber: 1, laneNumber: 7, squadId: "sq1-other" },
        { playerId: "p1", gameNumber: 2, laneNumber: 9, squadId: "sq1-other" },
      ],
      firstScores: [
        { playerId: "p1", gameNumber: 1, laneNumber: 3, score: 200 },
        { playerId: "p1", gameNumber: 2, laneNumber: 5, score: 210 },
      ],
      secondScores: [
        { playerId: "p1", gameNumber: 1, laneNumber: 7, score: 220 },
        { playerId: "p1", gameNumber: 2, laneNumber: 9, score: 230 },
      ],
      now: "2026-03-24T10:00:00.000Z",
    });

    expect(merged.event.gameCount).toBe(4);
    expect(merged.event.fivesConfig).toEqual({
      firstHalfGameCount: 2,
      secondHalfGameCount: 2,
    });
    expect(merged.archiveEventIds).toEqual(["evt-second"]);
    expect(merged.squads).toEqual([
      {
        id: "sq1",
        data: {
          name: "1조",
          createdAt: "2026-03-24T10:00:00.000Z",
        },
      },
    ]);

    expect(merged.teams).toEqual([
      {
        id: "team-a",
        data: {
          name: "A팀",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p5"],
          rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
          firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
          secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
          createdAt: "2026-03-24T10:00:00.000Z",
          updatedAt: "2026-03-24T10:00:00.000Z",
        },
      },
    ]);

    expect(merged.assignments.map((item) => item.data.gameNumber)).toEqual([1, 2, 3, 4]);
    expect(merged.assignments.map((item) => item.data.squadId)).toEqual(["sq1", "sq1", "sq1", "sq1"]);
    expect(merged.scores.map((item) => item.data.gameNumber)).toEqual([1, 2, 3, 4]);
    expect(merged.scores.map((item) => item.data.score)).toEqual([200, 210, 220, 230]);
    expect(merged.participants.map((item) => item.id)).toEqual(["p1", "p2", "p6"]);
    expect(merged.participants.map((item) => item.data.squadId)).toEqual(["sq1", "sq1", "sq1"]);
  });

  it("creates merged teams for unmatched second-half teams", () => {
    const merged = mergeLegacyFivesEvents({
      firstEvent: {
        id: "evt-first",
        title: "5인조",
        kind: "FIVES",
        gameCount: 3,
        scheduleDate: "2026-03-24",
        laneStart: 1,
        laneEnd: 10,
        tableShift: 2,
      },
      secondEvent: {
        id: "evt-second",
        title: "5인조",
        kind: "FIVES",
        gameCount: 3,
        scheduleDate: "2026-03-24",
        laneStart: 1,
        laneEnd: 10,
        tableShift: 2,
      },
      firstParticipants: [],
      secondParticipants: [],
      firstSquads: [],
      secondSquads: [],
      firstTeams: [],
      secondTeams: [
        {
          id: "team-second-only",
          name: "B팀",
          teamType: "MAKEUP",
          memberIds: ["p10", "p11", "p12", "p13", "p14"],
        },
      ],
      firstAssignments: [],
      secondAssignments: [],
      firstScores: [],
      secondScores: [],
      now: "2026-03-24T10:00:00.000Z",
      createTeamId: () => "team-generated",
    });

    expect(merged.teams).toEqual([
      {
        id: "team-generated",
        data: {
          name: "B팀",
          teamType: "MAKEUP",
          memberIds: ["p10", "p11", "p12", "p13", "p14"],
          rosterIds: ["p10", "p11", "p12", "p13", "p14"],
          firstHalfMemberIds: ["p10", "p11", "p12", "p13", "p14"],
          secondHalfMemberIds: ["p10", "p11", "p12", "p13", "p14"],
          createdAt: "2026-03-24T10:00:00.000Z",
          updatedAt: "2026-03-24T10:00:00.000Z",
        },
      },
    ]);
  });

  it("drops trailing group suffix when a normal team is merged across halves", () => {
    const mergedTeams = mergeLegacyFivesTeams({
      firstTeams: [
        {
          id: "team-first",
          name: "토평고A",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p5"],
        },
      ],
      secondTeams: [
        {
          id: "team-second",
          name: "토평고",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p6"],
        },
      ],
      now: "2026-03-24T10:00:00.000Z",
    });

    expect(mergedTeams[0]?.data.name).toBe("토평고");
  });
});
