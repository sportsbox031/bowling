import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";

export async function GET(req: NextRequest) {
  const [userSession, adminSession] = await Promise.all([
    resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value),
    verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value),
  ]);

  return NextResponse.json({
    ok: true,
    userActive: Boolean(userSession),
    adminActive: Boolean(adminSession),
    userApproved: Boolean(userSession?.isApproved),
  });
}
