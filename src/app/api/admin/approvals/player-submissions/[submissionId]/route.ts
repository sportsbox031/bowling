import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { applyApprovedPlayerRegistrationSubmission } from "@/lib/projections/player-registration-projection";
import { invalidateCache } from "@/lib/api-cache";
import { rebuildPublicTournamentAggregate } from "@/lib/aggregates/public-tournament";

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

  const submission = { id: submissionSnap.id, ...submissionSnap.data() } as any;
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

  return NextResponse.json({
    ok: true,
    status: "APPROVED",
    projectedPlayers: projection.players,
    singleEventIds: projection.singleEventIds,
  });
}
