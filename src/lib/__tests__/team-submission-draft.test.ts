import {
  buildAutoTeamNames,
  parseTeamPlayerNumberInput,
} from "@/lib/team-submission-draft";

describe("team-submission draft helpers", () => {
  it("builds automatic team names from organization and entry group", () => {
    expect(buildAutoTeamNames("광주광남고등학교", [
      { entryGroup: "A" },
      { entryGroup: "A" },
      { entryGroup: "B" },
    ])).toEqual([
      "광주광남고등학교A조",
      "광주광남고등학교A조 2팀",
      "광주광남고등학교B조",
    ]);
  });

  it("parses comma and range number input", () => {
    expect(parseTeamPlayerNumberInput("1, 3-5,7")).toEqual([1, 3, 4, 5, 7]);
  });

  it("returns null for invalid number tokens", () => {
    expect(parseTeamPlayerNumberInput("1,a,3")).toBeNull();
    expect(parseTeamPlayerNumberInput("5-2")).toBeNull();
  });
});
