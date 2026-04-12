import { buildApprovedEntryGroups, buildPlayerRegistrationSubmission, normalizePlayerRegistrationPlayers } from "@/lib/submissions/player-registration";

describe("player-registration submission helpers", () => {
  it("normalizes valid players only", () => {
    const players = normalizePlayerRegistrationPlayers([
      { name: "홍길동", number: 1 },
      { name: "", number: 2 },
    ]);
    expect(players).toHaveLength(1);
    expect(players[0]?.name).toBe("홍길동");
  });

  it("builds a submission document in submitted state", () => {
    const submission = buildPlayerRegistrationSubmission("sub-1", {
      tournamentId: "t-1",
      divisionId: "d-1",
      organizationId: "o-1",
      coachUid: "u-1",
      players: [
        { name: "홍길동", number: 1 },
      ],
    }, "2026-03-26T00:00:00.000Z");
    expect(submission.status).toBe("SUBMITTED");
    expect(submission.players).toHaveLength(1);
  });

  it("builds entry-group mapping by player number", () => {
    const groups = buildApprovedEntryGroups([
      { name: "1", number: 11 },
      { name: "2", number: 12 },
      { name: "3", number: 13 },
      { name: "4", number: 14 },
      { name: "5", number: 15 },
      { name: "6", number: 16 },
      { name: "7", number: 17 },
    ]);
    expect(groups[11]).toBe("A");
    expect(groups[17]).toBe("B");
  });
});
