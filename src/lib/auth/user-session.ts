import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import type { ApprovalStatus, UserProfile } from "@/lib/models-user";

export const USER_SESSION_COOKIE = "bowling_user_session";

export interface UserIdentity {
  uid: string;
  email?: string;
}

export interface UserSession extends UserIdentity {
  profile: UserProfile;
  status: ApprovalStatus;
  isApproved: boolean;
}

export const verifyUserSessionToken = async (sessionToken?: string | null): Promise<UserIdentity | null> => {
  if (!sessionToken || !adminAuth) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionToken, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    return null;
  }
};

export const readUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!adminDb) {
    return null;
  }

  const snap = await adminDb.doc(firestorePaths.user(uid)).get();
  if (!snap.exists) {
    return null;
  }

  const data = snap.data() ?? {};
  return {
    uid,
    email: String(data.email ?? ""),
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    status: (data.status as ApprovalStatus | undefined) ?? "PENDING_APPROVAL",
    privacyConsentAt: String(data.privacyConsentAt ?? ""),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    ...(typeof data.approvedAt === "string" ? { approvedAt: data.approvedAt } : {}),
    ...(typeof data.approvedBy === "string" ? { approvedBy: data.approvedBy } : {}),
    ...(typeof data.rejectedAt === "string" ? { rejectedAt: data.rejectedAt } : {}),
    ...(typeof data.rejectedBy === "string" ? { rejectedBy: data.rejectedBy } : {}),
    ...(typeof data.disabledAt === "string" ? { disabledAt: data.disabledAt } : {}),
    ...(typeof data.disabledBy === "string" ? { disabledBy: data.disabledBy } : {}),
    ...(typeof data.lastLoginAt === "string" ? { lastLoginAt: data.lastLoginAt } : {}),
    ...(typeof data.primaryOrganizationId === "string" ? { primaryOrganizationId: data.primaryOrganizationId } : {}),
  };
};

export const resolveUserSession = async (sessionToken?: string | null): Promise<UserSession | null> => {
  const identity = await verifyUserSessionToken(sessionToken);
  if (!identity) {
    return null;
  }

  const profile = await readUserProfile(identity.uid);
  if (!profile) {
    return null;
  }

  return {
    ...identity,
    profile,
    status: profile.status,
    isApproved: profile.status === "APPROVED",
  };
};
