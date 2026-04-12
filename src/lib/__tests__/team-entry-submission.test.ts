import {
  assignEntryGroupsToTeams,
  buildTeamEntrySubmission,
  buildAutoNamedTeams,
  normalizeTeamEntryTeams,
  validateNoDuplicatePlayersAcrossTeams,
} from "@/lib/submissions/team-entry";

describe("team-entry submission helpers", () => {
  it("allows partial doubles teams with one player", () => {
    const teams = normalizeTeamEntryTeams("DOUBLES", [
      { playerIds: ["p1", "p2"], entryGroup: "A" },
      { playerIds: ["p3"], entryGroup: "A" },
      { playerIds: ["p4", "p5", "p6"], entryGroup: "A" },
    ]);

    expect(teams).toEqual([
      { playerIds: ["p1", "p2"], entryGroup: "A", name: "" },
      { playerIds: ["p3"], entryGroup: "A", name: "" },
    ]);
  });

  it("normalizes fives rosters and default lineups", () => {
    const teams = normalizeTeamEntryTeams("FIVES", [
      { playerIds: ["p0"], entryGroup: "A" },
      { playerIds: ["p1", "p2", "p3", "p4", "p5", "p6"], entryGroup: "A" },
      { playerIds: ["p7", "p8", "p9", "p10", "p11", "p12", "p13", "p14"], entryGroup: "A" },
    ]);

    expect(teams).toHaveLength(2);
    expect(teams[0]?.playerIds).toEqual(["p0"]);
    expect(teams[0]?.firstHalfMemberIds).toEqual(["p0"]);
    expect(teams[1]?.firstHalfMemberIds).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(teams[1]?.secondHalfMemberIds).toBeUndefined();
  });

  it("allows partial triples teams with one or two players", () => {
    const teams = normalizeTeamEntryTeams("TRIPLES", [
      { playerIds: ["p1"], entryGroup: "A" },
      { playerIds: ["p2", "p3"], entryGroup: "A" },
      { playerIds: ["p4", "p5", "p6"], entryGroup: "A" },
      { playerIds: ["p7", "p8", "p9", "p10"], entryGroup: "A" },
    ]);

    expect(teams).toEqual([
      { playerIds: ["p1"], entryGroup: "A", name: "" },
      { playerIds: ["p2", "p3"], entryGroup: "A", name: "" },
      { playerIds: ["p4", "p5", "p6"], entryGroup: "A", name: "" },
    ]);
  });

  it("allows partial fives rosters with fewer than five players", () => {
    const teams = normalizeTeamEntryTeams("FIVES", [
      { playerIds: ["p1", "p2", "p3", "p4"], entryGroup: "A" },
    ]);

    expect(teams).toEqual([
      {
        playerIds: ["p1", "p2", "p3", "p4"],
        firstHalfMemberIds: ["p1", "p2", "p3", "p4"],
        entryGroup: "A",
        name: "",
      },
    ]);
  });

  it("rejects duplicate players across teams", () => {
    expect(validateNoDuplicatePlayersAcrossTeams([
      { playerIds: ["p1", "p2"], entryGroup: "A" },
      { playerIds: ["p2", "p3"], entryGroup: "A" },
    ])).toBe(false);
  });

  it("builds team-entry submission", () => {
    const submission = buildTeamEntrySubmission("sub-1", {
      tournamentId: "t-1",
      divisionId: "d-1",
      eventId: "e-1",
      organizationId: "o-1",
      coachUid: "u-1",
      teams: [{ playerIds: ["p1", "p2"], entryGroup: "A" }],
    }, "2026-03-26T00:00:00.000Z");

    expect(submission.status).toBe("SUBMITTED");
    expect(submission.teams).toHaveLength(1);
  });

  it("assigns entry groups from approved player data", () => {
    const teams = assignEntryGroupsToTeams(
      [{ playerIds: ["p1", "p2"], entryGroup: "A" }],
      (playerId) => ({
        entryGroup: playerId === "p1" || playerId === "p2" ? "A" : "B",
      }),
    );

    expect(teams).toEqual([{ playerIds: ["p1", "p2"], entryGroup: "A" }]);
  });

  it("rejects mixed entry groups inside one team", () => {
    const teams = assignEntryGroupsToTeams(
      [{ playerIds: ["p1", "p7"], entryGroup: "A" }],
      (playerId) => ({
        entryGroup: playerId === "p1" ? "A" : "B",
      }),
    );

    expect(teams).toBeNull();
  });

  it("builds automatic team names from organization and entry group", () => {
    expect(buildAutoNamedTeams("광주광남고등학교", [
      { playerIds: ["p1", "p2"], entryGroup: "A", name: "사용자입력" },
      { playerIds: ["p3", "p4"], entryGroup: "A" },
      { playerIds: ["p5", "p6"], entryGroup: "B" },
    ])).toEqual([
      { playerIds: ["p1", "p2"], entryGroup: "A", name: "광주광남고등학교A조" },
      { playerIds: ["p3", "p4"], entryGroup: "A", name: "광주광남고등학교A조 2팀" },
      { playerIds: ["p5", "p6"], entryGroup: "B", name: "광주광남고등학교B조" },
    ]);
  });
});
