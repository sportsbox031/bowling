import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { hasApprovedOrganizationAccess } from "@/lib/organization-membership-access";
import { normalizePlayerRegistrationPlayers } from "@/lib/submissions/player-registration";
import { snapToDoc } from "@/lib/firebase/docUtils";
import type { PlayerRegistrationSubmission } from "@/lib/models-user";

type Ctx = { params: { tournamentId: string; submissionId: string } };

/**
 * PUT /api/user/tournaments/[tournamentId]/player-submissions/[submissionId]
 * SUBMITTED 상태의 제출을 수정합니다. APPROVED/REJECTED 상태에서는 수정 불가.
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const body = await req.json().catch(() => null) as {
    players?: unknown;
  } | null;

  const players = normalizePlayerRegistrationPlayers(body?.players);
  if (players.length === 0) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const submissionRef = db.doc(
    firestorePaths.playerRegistrationSubmission(ctx.params.tournamentId, ctx.params.submissionId)
  );
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) {
    return NextResponse.json({ message: "SUBMISSION_NOT_FOUND" }, { status: 404 });
  }

  const submission = snapToDoc<PlayerRegistrationSubmission>(submissionSnap)!;

  // 본인 제출 여부 확인
  if (submission.coachUid !== session.uid) {
    return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  }

  // 소속 접근 권한 확인
  if (!(await hasApprovedOrganizationAccess(db, session.uid, submission.organizationId))) {
    return NextResponse.json({ message: "ORGANIZATION_FORBIDDEN" }, { status: 403 });
  }

  // SUBMITTED 상태에서만 수정 가능
  if (submission.status !== "SUBMITTED") {
    return NextResponse.json({ message: "SUBMISSION_NOT_EDITABLE" }, { status: 409 });
  }

  const now = new Date().toISOString();
  await submissionRef.set({ players, updatedAt: now }, { merge: true });

  return NextResponse.json({ ok: true, updatedAt: now });
}
