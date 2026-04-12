import {
  getFirstHalfGameNumbers,
  getHalfForGameNumber,
  getSecondHalfGameNumbers,
  isFivesEventConfig,
  normalizeFivesPhaseSplit,
} from "../fives-config";

describe("fives-config", () => {
  it("4게임 5인조는 전반 2게임, 후반 2게임으로 분리한다", () => {
    const config = normalizeFivesPhaseSplit({ gameCount: 4 });

    expect(config.firstHalfGameCount).toBe(2);
    expect(config.secondHalfGameCount).toBe(2);
    expect(getFirstHalfGameNumbers(config)).toEqual([1, 2]);
    expect(getSecondHalfGameNumbers(config)).toEqual([3, 4]);
  });

  it("6게임 5인조는 전반 3게임, 후반 3게임으로 분리한다", () => {
    const config = normalizeFivesPhaseSplit({ gameCount: 6 });

    expect(config.firstHalfGameCount).toBe(3);
    expect(config.secondHalfGameCount).toBe(3);
    expect(getFirstHalfGameNumbers(config)).toEqual([1, 2, 3]);
    expect(getSecondHalfGameNumbers(config)).toEqual([4, 5, 6]);
  });

  it("게임 번호별로 전반/후반을 판정한다", () => {
    const config = normalizeFivesPhaseSplit({ gameCount: 6 });

    expect(getHalfForGameNumber(config, 1)).toBe("FIRST");
    expect(getHalfForGameNumber(config, 3)).toBe("FIRST");
    expect(getHalfForGameNumber(config, 4)).toBe("SECOND");
    expect(getHalfForGameNumber(config, 6)).toBe("SECOND");
    expect(getHalfForGameNumber(config, 7)).toBeNull();
  });

  it("5인조 설정 객체 여부를 판정한다", () => {
    expect(isFivesEventConfig({ firstHalfGameCount: 2, secondHalfGameCount: 2 })).toBe(true);
    expect(isFivesEventConfig({ firstHalfGameCount: 2 })).toBe(false);
    expect(isFivesEventConfig(null)).toBe(false);
  });
});
