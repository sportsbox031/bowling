import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminAuth } from "@/lib/firebase/admin";

type Ctx = { params: { uid: string } };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminAuth) return NextResponse.json({ message: "AUTH_NOT_READY" }, { status: 503 });

  try {
    await adminAuth.updateUser(ctx.params.uid, { password: "0000" });
    return NextResponse.json({ ok: true, resetTo: "0000" });
  } catch (error) {
    return NextResponse.json({ message: "PASSWORD_RESET_FAILED", error: String((error as Error).message) }, { status: 500 });
  }
}
