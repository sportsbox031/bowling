export type UserProfileBundleMembership = {
  id: string;
  organizationId: string;
  status: string;
  removalRequestedAt?: string;
};

export type UserProfileBundleOrganization = {
  id: string;
  name: string;
  status: string;
};

export type UserProfileBundle = {
  memberships?: UserProfileBundleMembership[];
  organizations?: UserProfileBundleOrganization[];
};

export const fetchUserProfileBundle = async (): Promise<UserProfileBundle> => {
  const response = await fetch("/api/user/profile", {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("계정 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<UserProfileBundle>;
};

export const getApprovedOrganizationsFromBundle = (
  bundle: UserProfileBundle,
): Array<{ id: string; name: string }> => {
  const memberships = bundle.memberships ?? [];
  const organizationsById = new Map(
    (bundle.organizations ?? []).map((organization) => [organization.id, organization]),
  );

  return memberships
    .filter((membership) => membership.status === "APPROVED")
    .map((membership) => {
      const organization = organizationsById.get(membership.organizationId);
      return organization ? { id: organization.id, name: organization.name } : null;
    })
    .filter((value): value is { id: string; name: string } => Boolean(value));
};
