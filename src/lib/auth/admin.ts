import { adminAuth } from "@/lib/firebase/admin";

export const ADMIN_SESSION_COOKIE = "bowling_admin_session";

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

const allowedEmails = new Set(
  (process.env.FIREBASE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export interface AdminSession {
  uid: string;
  email?: string;
  isAdmin: boolean;
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(TEN_DAYS_MS / 1000);

export const isEmailAllowed = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }

  return allowedEmails.has(email.toLowerCase());
};

export const isAdminDecodedToken = (decoded: { uid?: string; email?: string; admin?: boolean }): boolean => {
  if (decoded.admin === true) {
    return true;
  }

  return isEmailAllowed(decoded.email);
};

export const verifyAdminSessionToken = async (sessionToken?: string | null): Promise<AdminSession | null> => {
  if (!sessionToken || !adminAuth) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionToken, true);
    const uid = decoded.uid;
    const isAdmin = isAdminDecodedToken(decoded);
    if (!isAdmin) {
      return null;
    }

    return { uid, email: decoded.email, isAdmin: true };
  } catch {
    return null;
  }
};
