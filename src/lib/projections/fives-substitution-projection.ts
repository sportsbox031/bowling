import type { Firestore } from "firebase-admin/firestore";
import { firestorePaths } from "@/lib/firebase/schema";
import type { FivesSubstitutionSubmission } from "@/lib/models-user";

export async function applyApprovedFivesSubstitutionSubmission(
  db: Firestore,
  submission: FivesSubstitutionSubmission,
  approval: { approvedAt: string; approvedBy: string },
) {
  const teamRef = db.doc(
    firestorePaths.team(
      submission.tournamentId,
      submission.divisionId,
      submission.eventId,
      submission.teamId,
    ),
  );
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) {
    throw new Error("TEAM_NOT_FOUND");
  }

  const batch = db.batch();
  batch.set(
    teamRef,
    {
      secondHalfMemberIds: submission.secondHalfMemberIds,
      updatedAt: approval.approvedAt,
    },
    { merge: true },
  );
  batch.set(
    db.doc(firestorePaths.fivesSubstitutionSubmission(submission.tournamentId, submission.id)),
    {
      status: "APPROVED",
      updatedAt: approval.approvedAt,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
    },
    { merge: true },
  );

  await batch.commit();
  return { teamId: submission.teamId };
}
