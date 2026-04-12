import { buildFivesAssignmentSegments, calculateRandomAssignments } from "@/lib/services/competitionService";

describe("competitionService assignments", () => {
  it("builds first-half and second-half segments for fives", () => {
    expect(buildFivesAssignmentSegments(4, {
      firstHalfGameCount: 2,
      secondHalfGameCount: 2,
    })).toEqual([
      { startGame: 1, endGame: 2 },
      { startGame: 3, endGame: 4 },
    ]);
  });

  it("restarts lane anchors for each segment", () => {
    const result = calculateRandomAssignments({
      playerIds: ["p1", "p2", "p3", "p4"],
      range: { start: 1, end: 2 },
      gameCount: 4,
      tableShift: 1,
      seed: 10,
      segments: [
        { startGame: 1, endGame: 2 },
        { startGame: 3, endGame: 4 },
      ],
    });

    const game1 = result.gameBoard[1];
    const game2 = result.gameBoard[2];
    const game3 = result.gameBoard[3];
    const game4 = result.gameBoard[4];

    expect(game1).toBeDefined();
    expect(game2).toBeDefined();
    expect(game3).toBeDefined();
    expect(game4).toBeDefined();

    const game1LaneMap = new Map(game1.map((item) => [item.playerId, item.laneNumber]));
    const game2LaneMap = new Map(game2.map((item) => [item.playerId, item.laneNumber]));
    const game3LaneMap = new Map(game3.map((item) => [item.playerId, item.laneNumber]));
    const game4LaneMap = new Map(game4.map((item) => [item.playerId, item.laneNumber]));

    expect(result.firstGameAssignments.map((item) => item.gameNumber)).toEqual([1, 1, 1, 1, 3, 3, 3, 3]);

    for (const playerId of game1LaneMap.keys()) {
      expect(game2LaneMap.get(playerId)).not.toBe(game1LaneMap.get(playerId));
      expect(game4LaneMap.get(playerId)).not.toBe(game3LaneMap.get(playerId));
    }
  });
});
