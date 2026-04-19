import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { hasApprovedOrganizationAccess } from "@/lib/organization-membership-access";
import {
  normalizeTeamEntryTeams,
  validateNoDuplicatePlayersAcrossTeams,
} from "@/lib/submissions/team-entry";
import { snapToDoc } from "@/lib/firebase/docUtils";
import type { TeamEntrySubmission } from "@/lib/models-user";

type Ctx = { params: { tournamentId: string; submissionId: string } };

/**
 * PUT /api/user/tournaments/[tournamentId]/team-submissions/[submissionId]
 * SUBMITTED 상태의 팀편성 제출을 수정합니다.
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const body = await req.json().catch(() => null) as {
    teams?: unknown;
  } | null;

  const submissionRef = db.doc(
    firestorePaths.teamEntrySubmission(ctx.params.tournamentId, ctx.params.submissionId)
  );
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) {
    return NextResponse.json({ message: "SUBMISSION_NOT_FOUND" }, { status: 404 });
  }

  const submission = snapToDoc<TeamEntrySubmission>(submissionSnap)!;

  if (submission.coachUid !== session.uid) {
    return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  }

  if (!(await hasApprovedOrganizationAccess(db, session.uid, submission.organizationId))) {
    return NextResponse.json({ message: "ORGANIZATION_FORBIDDEN" }, { status: 403 });
  }

  if (submission.status !== "SUBMITTED") {
    return NextResponse.json({ message: "SUBMISSION_NOT_EDITABLE" }, { status: 409 });
  }

  const eventSnap = await db
    .doc(firestorePaths.event(ctx.params.tournamentId, submission.divisionId, submission.eventId))
    .get();
  if (!eventSnap.exists) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  const eventKind = String(eventSnap.data()?.kind ?? "") as "DOUBLES" | "TRIPLES" | "FIVES";

  const teams = normalizeTeamEntryTeams(eventKind, body?.teams);
  if (teams.length === 0) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  if (!validateNoDuplicatePlayersAcrossTeams(teams)) {
    return NextResponse.json({ message: "DUPLICATE_PLAYERS" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await submissionRef.set({ teams, updatedAt: now }, { merge: true });

  return NextResponse.json({ ok: true, updatedAt: now });
}
