import {
  getBenchPlayerIdsForHalf,
  getLineupForGameNumber,
  isLineupComplete,
  normalizeFivesLineups,
} from "../fives-lineup";

describe("fives-lineup", () => {
  it("기본값으로 전반/후반 라인업을 같은 5명으로 초기화한다", () => {
    const lineups = normalizeFivesLineups({
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
    });

    expect(lineups.firstHalfMemberIds).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(lineups.secondHalfMemberIds).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("게임 번호에 따라 전반/후반 라인업을 반환한다", () => {
    const lineups = normalizeFivesLineups({
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
    });

    expect(getLineupForGameNumber(lineups, { firstHalfGameCount: 2, secondHalfGameCount: 2 }, 1)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(getLineupForGameNumber(lineups, { firstHalfGameCount: 2, secondHalfGameCount: 2 }, 4)).toEqual(["p1", "p2", "p3", "p4", "p6"]);
  });

  it("후반 벤치 선수를 계산한다", () => {
    const lineups = normalizeFivesLineups({
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
    });

    expect(getBenchPlayerIdsForHalf(lineups, "FIRST")).toEqual(["p6", "p7"]);
    expect(getBenchPlayerIdsForHalf(lineups, "SECOND")).toEqual(["p5", "p7"]);
  });

  it("라인업이 정확히 5명이면 complete로 본다", () => {
    expect(isLineupComplete(["p1", "p2", "p3", "p4", "p5"], 5)).toBe(true);
    expect(isLineupComplete(["p1", "p2", "p3", "p4"], 5)).toBe(false);
  });
});
