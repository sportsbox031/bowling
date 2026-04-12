import { normalizeTeamEntryTeams } from "@/lib/submissions/team-entry";

describe("fives initial team submission", () => {
  it("stores only roster and first-half lineup during initial submission", () => {
    const teams = normalizeTeamEntryTeams("FIVES", [
      {
        playerIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
        firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
        secondHalfMemberIds: ["p2", "p3", "p4", "p5", "p6"],
        entryGroup: "A",
      },
    ]);

    expect(teams).toHaveLength(1);
    expect(teams[0]?.playerIds).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
    expect(teams[0]?.firstHalfMemberIds).toEqual(["p1", "p2", "p3", "p4", "p6"]);
    expect(teams[0]?.secondHalfMemberIds).toBeUndefined();
  });
});
