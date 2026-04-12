import { compareEventDisplay, getEventDisplayOrder } from "../event-display-order";

describe("event-display-order", () => {
  it("개인, 2인조, 3인조, 5인조 전반, 5인조 후반 순으로 정렬한다", () => {
    const events = [
      { title: "5인조 후반", kind: "FIVES", halfType: "SECOND" },
      { title: "3인조", kind: "TRIPLES" },
      { title: "개인전", kind: "SINGLE" },
      { title: "5인조 전반", kind: "FIVES", halfType: "FIRST" },
      { title: "2인조", kind: "DOUBLES" },
    ];

    const sorted = [...events].sort(compareEventDisplay);

    expect(sorted.map((event) => event.title)).toEqual([
      "개인전",
      "2인조",
      "3인조",
      "5인조 전반",
      "5인조 후반",
    ]);
  });

  it("halfType 없이도 제목의 전반/후반으로 순서를 구분한다", () => {
    expect(getEventDisplayOrder({ title: "5인조 전반" })).toBeLessThan(
      getEventDisplayOrder({ title: "5인조 후반" }),
    );
  });
});
