import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserSession, USER_SESSION_COOKIE } from "@/lib/auth/user-session";

type RequireUserSessionOptions = {
  allowPending?: boolean;
  loginRedirectTo?: string;
  pendingRedirectTo?: string;
};

export async function requireUserSession(options?: RequireUserSessionOptions) {
  const session = await resolveUserSession(cookies().get(USER_SESSION_COOKIE)?.value);
  if (!session) {
    redirect(options?.loginRedirectTo ?? "/login");
  }

  if (!options?.allowPending && !session.isApproved) {
    redirect(options?.pendingRedirectTo ?? "/pending");
  }

  return session;
}

export async function requireApprovedUserSession(options?: Omit<RequireUserSessionOptions, "allowPending">) {
  return requireUserSession({ ...options, allowPending: false });
}
