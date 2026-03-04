import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
  isAdminDecodedToken,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/admin";

interface SignInPayload {
  idToken?: string;
}

const cookieSettings = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

export async function POST(req: NextRequest) {
  if (!adminAuth) {
    return NextResponse.json({ message: "ADMIN_AUTH_NOT_READY" }, { status: 503 });
  }

  const body = (await req.json()) as SignInPayload;
  const idToken = body.idToken;
  if (!idToken) {
    return NextResponse.json({ message: "ID_TOKEN_REQUIRED" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!isAdminDecodedToken(decoded)) {
      return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
    }

    const expiresIn = SESSION_MAX_AGE_SECONDS * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: sessionCookie,
      ...cookieSettings,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: "SIGNIN_FAILED", error: String((error as Error).message) },
      { status: 401 },
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, session });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
