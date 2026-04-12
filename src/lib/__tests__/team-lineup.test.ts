import {
  getTeamActiveMemberIdsForGame,
  getTeamBenchMemberIdsForGame,
  getTeamRosterIds,
} from "@/lib/team-lineup";

describe("team-lineup", () => {
  it("returns roster ids with duplicates removed", () => {
    expect(getTeamRosterIds({
      memberIds: ["p1", "p2"],
      firstHalfMemberIds: ["p1", "p2", "p3"],
      secondHalfMemberIds: ["p3", "p4"],
    })).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("returns first-half lineup for first-half games", () => {
    const team = {
      memberIds: ["p1", "p2", "p3", "p4", "p5"],
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p2", "p3", "p4", "p5", "p6"],
    };

    expect(getTeamActiveMemberIdsForGame(team, {
      kind: "FIVES",
      gameNumber: 2,
      gameCount: 4,
      fivesConfig: { firstHalfGameCount: 2, secondHalfGameCount: 2 },
    })).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("returns second-half lineup and bench for second-half games", () => {
    const team = {
      memberIds: ["p1", "p2", "p3", "p4", "p5"],
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p2", "p3", "p4", "p5", "p6"],
    };

    expect(getTeamActiveMemberIdsForGame(team, {
      kind: "FIVES",
      gameNumber: 4,
      gameCount: 4,
      fivesConfig: { firstHalfGameCount: 2, secondHalfGameCount: 2 },
    })).toEqual(["p2", "p3", "p4", "p5", "p6"]);

    expect(getTeamBenchMemberIdsForGame(team, {
      kind: "FIVES",
      gameNumber: 4,
      gameCount: 4,
      fivesConfig: { firstHalfGameCount: 2, secondHalfGameCount: 2 },
    })).toEqual(["p1", "p7"]);
  });

  it("falls back to member ids for non-fives events", () => {
    expect(getTeamActiveMemberIdsForGame({
      memberIds: ["p1", "p2"],
      rosterIds: ["p1", "p2", "p3"],
    }, {
      kind: "DOUBLES",
      gameNumber: 1,
      gameCount: 3,
    })).toEqual(["p1", "p2"]);
  });
});
