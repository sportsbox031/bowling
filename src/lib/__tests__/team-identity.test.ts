import { deriveTeamIdentity } from "../team-identity";

describe("deriveTeamIdentity", () => {
  it("같은 소속과 같은 조면 NORMAL과 소속+조 이름을 반환한다", () => {
    const result = deriveTeamIdentity([
      { affiliation: "드림클럽", group: "A" },
      { affiliation: "드림클럽", group: "A" },
      { affiliation: "드림클럽", group: "A" },
      { affiliation: "드림클럽", group: "A" },
      { affiliation: "드림클럽", group: "A" },
    ]);

    expect(result.teamType).toBe("NORMAL");
    expect(result.normalTeamName).toBe("드림클럽A");
  });

  it("같은 소속이어도 조가 다르면 NORMAL과 소속명만 반환한다", () => {
    const result = deriveTeamIdentity([
      { affiliation: "드림클럽", group: "A" },
      { affiliation: "드림클럽", group: "B" },
      { affiliation: "드림클럽", group: "A" },
      { affiliation: "드림클럽", group: "B" },
      { affiliation: "드림클럽", group: "A" },
    ]);

    expect(result.teamType).toBe("NORMAL");
    expect(result.normalTeamName).toBe("드림클럽");
  });

  it("소속이 섞이면 MAKEUP을 반환한다", () => {
    const result = deriveTeamIdentity([
      { affiliation: "드림클럽", group: "A" },
      { affiliation: "챌린저스", group: "A" },
    ]);

    expect(result.teamType).toBe("MAKEUP");
    expect(result.normalTeamName).toBeUndefined();
  });
});
