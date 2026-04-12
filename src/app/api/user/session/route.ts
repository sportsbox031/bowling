import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/admin";
import {
  USER_SESSION_COOKIE,
  readUserProfile,
  resolveUserSession,
  verifyUserSessionToken,
} from "@/lib/auth/user-session";

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
    return NextResponse.json({ message: "AUTH_NOT_READY" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as SignInPayload | null;
  const idToken = body?.idToken;
  if (!idToken) {
    return NextResponse.json({ message: "ID_TOKEN_REQUIRED" }, { status: 400 });
  }

  try {
    await adminAuth.verifyIdToken(idToken);
    const expiresIn = SESSION_MAX_AGE_SECONDS * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: USER_SESSION_COOKIE,
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
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const sessionToken = req.cookies.get(USER_SESSION_COOKIE)?.value;
  const session = await resolveUserSession(sessionToken);
  if (!session) {
    const identity = await verifyUserSessionToken(sessionToken);
    if (!identity) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    if (!(await readUserProfile(identity.uid))) {
      return NextResponse.json({
        ok: true,
        session: {
          uid: identity.uid,
          email: identity.email ?? "",
          status: "PENDING_APPROVAL",
          isApproved: false,
          name: "",
          primaryOrganizationId: null,
          hasProfile: false,
        },
      });
    }

    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    session: {
      uid: session.uid,
      email: session.email ?? session.profile.email,
      status: session.status,
      isApproved: session.isApproved,
      name: session.profile.name,
      primaryOrganizationId: session.profile.primaryOrganizationId ?? null,
      hasProfile: true,
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: USER_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
