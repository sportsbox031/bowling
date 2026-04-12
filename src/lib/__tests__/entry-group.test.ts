import { assignEntryGroups, getEntryGroupForOrder } from "@/lib/entry-group";

describe("entry-group", () => {
  it("assigns A group to entries 1 through 6", () => {
    expect(getEntryGroupForOrder(1)).toBe("A");
    expect(getEntryGroupForOrder(6)).toBe("A");
  });

  it("assigns B group to entries after 6", () => {
    expect(getEntryGroupForOrder(7)).toBe("B");
    expect(getEntryGroupForOrder(12)).toBe("B");
  });

  it("annotates a list with order and entry group", () => {
    const result = assignEntryGroups([{ name: "p1" }, { name: "p2" }, { name: "p3" }, { name: "p4" }, { name: "p5" }, { name: "p6" }, { name: "p7" }]);
    expect(result[0]).toMatchObject({ name: "p1", entryOrder: 1, entryGroup: "A" });
    expect(result[6]).toMatchObject({ name: "p7", entryOrder: 7, entryGroup: "B" });
  });
});
