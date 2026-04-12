import { buildTeamSquadCards } from "@/lib/admin/team-squad";

describe("team squad cards", () => {
  const players = [
    { id: "p1", number: 1, name: "김하나", affiliation: "A고" },
    { id: "p2", number: 2, name: "김둘", affiliation: "A고" },
    { id: "p3", number: 3, name: "김셋", affiliation: "A고" },
    { id: "p4", number: 4, name: "김넷", affiliation: "A고" },
    { id: "p5", number: 5, name: "김다섯", affiliation: "A고" },
    { id: "p6", number: 6, name: "김여섯", affiliation: "A고" },
    { id: "p7", number: 7, name: "박하나", affiliation: "B고" },
    { id: "p8", number: 8, name: "박둘", affiliation: "B고" },
  ];

  it("uses fives roster ids when building team members", () => {
    const cards = buildTeamSquadCards(
      [
        {
          id: "team-1",
          name: "A고 5인조",
          teamType: "NORMAL",
          memberIds: ["p1", "p2", "p3", "p4", "p5"],
          rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
        },
      ],
      players,
      [
        { id: "p1", playerId: "p1", squadId: "sq-a" },
        { id: "p2", playerId: "p2", squadId: "sq-a" },
        { id: "p3", playerId: "p3", squadId: "sq-a" },
        { id: "p4", playerId: "p4", squadId: "sq-a" },
        { id: "p5", playerId: "p5", squadId: "sq-a" },
        { id: "p6", playerId: "p6", squadId: "sq-a" },
      ],
    );

    expect(cards[0]).toMatchObject({
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      currentSquadId: "sq-a",
      status: "assigned",
    });
    expect(cards[0]?.members.map((member) => member.id)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("marks a team as mixed when members are spread across squads", () => {
    const cards = buildTeamSquadCards(
      [
        {
          id: "team-1",
          name: "A고 2인조",
          teamType: "NORMAL",
          memberIds: ["p1", "p2"],
        },
      ],
      players,
      [
        { id: "p1", playerId: "p1", squadId: "sq-a" },
        { id: "p2", playerId: "p2", squadId: "sq-b" },
      ],
    );

    expect(cards[0]).toMatchObject({
      currentSquadId: null,
      status: "mixed",
      memberSquadIds: ["sq-a", "sq-b"],
    });
  });

  it("filters by the selected squad while keeping mixed teams visible", () => {
    const cards = buildTeamSquadCards(
      [
        {
          id: "team-1",
          name: "A고 2인조",
          teamType: "NORMAL",
          memberIds: ["p1", "p2"],
        },
        {
          id: "team-2",
          name: "B고 2인조",
          teamType: "NORMAL",
          memberIds: ["p7", "p8"],
        },
      ],
      players,
      [
        { id: "p1", playerId: "p1", squadId: "sq-a" },
        { id: "p2", playerId: "p2", squadId: "sq-b" },
        { id: "p7", playerId: "p7", squadId: "sq-b" },
        { id: "p8", playerId: "p8", squadId: "sq-b" },
      ],
      "sq-a",
    );

    expect(cards.map((card) => card.id)).toEqual(["team-1"]);
  });
});
