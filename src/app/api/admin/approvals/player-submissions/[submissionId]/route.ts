import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { applyApprovedPlayerRegistrationSubmission } from "@/lib/projections/player-registration-projection";
import { invalidateCache } from "@/lib/api-cache";
import { rebuildPublicTournamentAggregate } from "@/lib/aggregates/public-tournament";
import { snapToDoc } from "@/lib/firebase/docUtils";
import type { PlayerRegistrationSubmission } from "@/lib/models-user";
import { writeAuditLog } from "@/lib/admin/audit";
import { createNotification } from "@/lib/admin/notify";

type Ctx = { params: { submissionId: string } };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    tournamentId?: string;
    action?: "APPROVE" | "REJECT";
    rejectionReason?: string;
  } | null;

  const tournamentId = String(body?.tournamentId ?? "").trim();
  const action = body?.action;
  if (!tournamentId || !action) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const submissionRef = adminDb.doc(firestorePaths.playerRegistrationSubmission(tournamentId, ctx.params.submissionId));
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) {
    return NextResponse.json({ message: "SUBMISSION_NOT_FOUND" }, { status: 404 });
  }

  const submission = snapToDoc<PlayerRegistrationSubmission>(submissionSnap)!;
  if (submission.status !== "SUBMITTED") {
    return NextResponse.json({ message: "SUBMISSION_NOT_PENDING" }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === "REJECT") {
    await submissionRef.set({
      status: "REJECTED",
      updatedAt: now,
      rejectedAt: now,
      rejectedBy: session.uid,
      rejectionReason: typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() : "",
    }, { merge: true });
    void writeAuditLog(adminDb, {
      targetType: "PLAYER_SUBMISSION",
      targetId: ctx.params.submissionId,
      action: "REJECT",
      actorUid: session.uid,
      tournamentId,
      note: body?.rejectionReason ?? "",
    });
    void createNotification(adminDb, {
      uid: submission.coachUid,
      type: "SUBMISSION_REJECTED",
      targetType: "PLAYER_SUBMISSION",
      targetId: ctx.params.submissionId,
      tournamentId,
      message: `선수등록 제출이 반려되었습니다.${body?.rejectionReason ? ` 사유: ${body.rejectionReason}` : ""}`,
    });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const projection = await applyApprovedPlayerRegistrationSubmission(adminDb, submission, {
    approvedAt: now,
    approvedBy: session.uid,
  });

  invalidateCache(`pub-tournament:${tournamentId}`);
  invalidateCache(`bundle-full:${tournamentId}`);
  invalidateCache(`bundle-setup:${tournamentId}`);
  for (const eventId of projection.singleEventIds) {
    invalidateCache(`bundle-setup:${tournamentId}:${submission.divisionId}:${eventId}`);
    invalidateCache(`bundle-full:${tournamentId}:${submission.divisionId}:${eventId}`);
  }
  await rebuildPublicTournamentAggregate(adminDb, tournamentId).catch(() => null);

  void writeAuditLog(adminDb, {
    targetType: "PLAYER_SUBMISSION",
    targetId: ctx.params.submissionId,
    action: "APPROVE",
    actorUid: session.uid,
    tournamentId,
  });
  void createNotification(adminDb, {
    uid: submission.coachUid,
    type: "SUBMISSION_APPROVED",
    targetType: "PLAYER_SUBMISSION",
    targetId: ctx.params.submissionId,
    tournamentId,
    message: "선수등록 제출이 승인되었습니다.",
  });

  return NextResponse.json({
    ok: true,
    status: "APPROVED",
    projectedPlayers: projection.players,
    singleEventIds: projection.singleEventIds,
  });
}
