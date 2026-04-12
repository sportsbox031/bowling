import {
  buildOrganizationRecord,
  getRepresentativeOrganizationName,
  hasApprovedOrganizationMembership,
  normalizeOrganizationName,
  summarizeMembershipStatus,
} from "@/lib/organizations";

describe("organizations helpers", () => {
  it("normalizes organization names consistently", () => {
    expect(normalizeOrganizationName("  수원  유스  ")).toBe("수원 유스");
  });

  it("builds a normalized pending organization record by default", () => {
    expect(buildOrganizationRecord({
      id: "org-1",
      name: " 수원유스 ",
      createdBy: "user-1",
      now: "2026-03-26T10:00:00.000Z",
    })).toEqual({
      id: "org-1",
      name: "수원유스",
      normalizedName: "수원유스",
      status: "PENDING",
      createdAt: "2026-03-26T10:00:00.000Z",
      updatedAt: "2026-03-26T10:00:00.000Z",
      createdBy: "user-1",
    });
  });

  it("detects approved organization membership", () => {
    expect(hasApprovedOrganizationMembership([
      { organizationId: "org-1", status: "PENDING_APPROVAL" },
      { organizationId: "org-2", status: "APPROVED" },
    ] as any, "org-2")).toBe(true);
    expect(hasApprovedOrganizationMembership([
      { organizationId: "org-1", status: "PENDING_APPROVAL" },
    ] as any, "org-1")).toBe(false);
  });

  it("picks the first approved organization as representative", () => {
    expect(getRepresentativeOrganizationName(
      [
        { id: "org-1", name: "수원유스" },
        { id: "org-2", name: "토평고" },
      ],
      [
        { organizationId: "org-2", status: "APPROVED" },
        { organizationId: "org-1", status: "PENDING_APPROVAL" },
      ] as any,
    )).toBe("토평고");
  });

  it("summarizes membership status with approved taking precedence", () => {
    expect(summarizeMembershipStatus([
      { status: "PENDING_APPROVAL" },
      { status: "APPROVED" },
    ] as any)).toBe("APPROVED");
    expect(summarizeMembershipStatus([
      { status: "PENDING_APPROVAL" },
    ] as any)).toBe("PENDING_APPROVAL");
  });
});
