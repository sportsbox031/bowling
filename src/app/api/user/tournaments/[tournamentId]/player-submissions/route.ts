import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { getApprovedOrganizationIdsForUser } from "@/lib/approved-organization-ids";
import { hasApprovedOrganizationAccess } from "@/lib/organization-membership-access";
import {
  buildPlayerRegistrationSubmission,
  normalizePlayerRegistrationPlayers,
} from "@/lib/submissions/player-registration";

type Ctx = { params: { tournamentId: string } };
type SubmissionRecord = {
  id: string;
  organizationId?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const snap = await db
    .collection(firestorePaths.playerRegistrationSubmissions(ctx.params.tournamentId))
    .where("coachUid", "==", session.uid)
    .get();
  const approvedOrganizationIds = await getApprovedOrganizationIdsForUser(db, session.uid);

  return NextResponse.json({
    items: snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as SubmissionRecord)
      .filter((item) => approvedOrganizationIds.has(String(item.organizationId ?? "").trim()))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const body = await req.json().catch(() => null) as {
    divisionId?: string;
    organizationId?: string;
    players?: unknown;
  } | null;

  const divisionId = String(body?.divisionId ?? "").trim();
  const organizationId = String(body?.organizationId ?? "").trim();
  const players = normalizePlayerRegistrationPlayers(body?.players);
  if (!divisionId || !organizationId || players.length === 0) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  if (!(await hasApprovedOrganizationAccess(db, session.uid, organizationId))) {
    return NextResponse.json({ message: "ORGANIZATION_FORBIDDEN" }, { status: 403 });
  }

  const submissionsRef = db.collection(firestorePaths.playerRegistrationSubmissions(ctx.params.tournamentId));
  const submissionRef = submissionsRef.doc();
  const now = new Date().toISOString();
  const submission = buildPlayerRegistrationSubmission(submissionRef.id, {
    tournamentId: ctx.params.tournamentId,
    divisionId,
    organizationId,
    coachUid: session.uid,
    players,
  }, now);

  await submissionRef.set(submission);
  return NextResponse.json({ item: submission }, { status: 201 });
}
