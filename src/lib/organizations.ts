import type { ApprovalStatus, Organization, UserOrganizationMembership } from "@/lib/models-user";

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeOrganizationName = (value: string): string =>
  normalizeWhitespace(value).toLocaleLowerCase("ko");

export const buildOrganizationRecord = (input: {
  id: string;
  name: string;
  createdBy: string;
  now: string;
  status?: Organization["status"];
}): Organization => ({
  id: input.id,
  name: normalizeWhitespace(input.name),
  normalizedName: normalizeOrganizationName(input.name),
  status: input.status ?? "PENDING",
  createdAt: input.now,
  updatedAt: input.now,
  createdBy: input.createdBy,
});

export const hasApprovedOrganizationMembership = (
  memberships: UserOrganizationMembership[],
  organizationId: string,
): boolean =>
  memberships.some((membership) =>
    membership.organizationId === organizationId && membership.status === "APPROVED",
  );

export const getRepresentativeOrganizationName = (
  organizations: Pick<Organization, "id" | "name">[],
  memberships: Pick<UserOrganizationMembership, "organizationId" | "status">[],
): string | null => {
  const approvedOrgIds = new Set(
    memberships
      .filter((membership) => membership.status === "APPROVED")
      .map((membership) => membership.organizationId),
  );

  const firstApproved = organizations.find((organization) => approvedOrgIds.has(organization.id));
  return firstApproved?.name ?? null;
};

export const summarizeMembershipStatus = (memberships: Pick<UserOrganizationMembership, "status">[]): ApprovalStatus => {
  if (memberships.some((membership) => membership.status === "APPROVED")) {
    return "APPROVED";
  }
  if (memberships.some((membership) => membership.status === "PENDING_APPROVAL")) {
    return "PENDING_APPROVAL";
  }
  if (memberships.some((membership) => membership.status === "REJECTED")) {
    return "REJECTED";
  }
  return "DISABLED";
};
