import type { Firestore } from "firebase-admin/firestore";
import { firestorePaths } from "@/lib/firebase/schema";
import type { EntryGroup, PlayerRegistrationSubmission } from "@/lib/models-user";
import { getNextPlayerNumber, buildPlayerDocument } from "@/lib/admin/players";
import { assignEntryGroups } from "@/lib/entry-group";
import { buildApprovedEntryGroups } from "@/lib/submissions/player-registration";

type ApprovedProjectedPlayer = {
  playerId: string;
  number: number;
  name: string;
  entryGroup: EntryGroup;
};

export type PlayerRegistrationProjectionResult = {
  players: ApprovedProjectedPlayer[];
  singleEventIds: string[];
};

export async function applyApprovedPlayerRegistrationSubmission(
  db: Firestore,
  submission: PlayerRegistrationSubmission,
  approval: { approvedAt: string; approvedBy: string },
): Promise<PlayerRegistrationProjectionResult> {
  const tournamentRef = db.collection("tournaments").doc(submission.tournamentId);
  const divisionRef = tournamentRef.collection("divisions").doc(submission.divisionId);
  const playersRef = tournamentRef.collection("players");
  const [tournamentSnap, organizationSnap] = await Promise.all([
    tournamentRef.get(),
    db.doc(firestorePaths.organization(submission.organizationId)).get(),
  ]);

  const eventsSnap = await divisionRef.collection("events").get();
  const singleEventDocs = eventsSnap.docs.filter((doc) => {
    const data = doc.data() ?? {};
    return data.kind === "SINGLE" && data.hidden !== true;
  });

  const startingNumber = await getNextPlayerNumber(db, submission.tournamentId);
  const batch = db.batch();
  const projectedPlayers: ApprovedProjectedPlayer[] = [];
  const assignedPlayers = assignEntryGroups(submission.players);
  const tournamentRegion = String(tournamentSnap.data()?.region ?? "").trim();
  const organizationName = String(organizationSnap.data()?.name ?? "").trim();

  for (const [index, player] of assignedPlayers.entries()) {
    const playerRef = playersRef.doc();
    const playerData = await buildPlayerDocument(db, submission.tournamentId, {
      divisionId: submission.divisionId,
      group: player.entryGroup,
      region: String(player.region ?? "").trim() || tournamentRegion,
      affiliation: String(player.affiliation ?? "").trim() || organizationName,
      name: player.name,
      hand: player.hand === "left" ? "left" : "right",
    }, startingNumber + index);

    batch.set(playerRef, {
      ...playerData,
      organizationId: submission.organizationId,
      submittedBy: submission.coachUid,
      playerRegistrationSubmissionId: submission.id,
      entryGroup: player.entryGroup,
      updatedAt: approval.approvedAt,
    });

    for (const singleEventDoc of singleEventDocs) {
      batch.set(singleEventDoc.ref.collection("participants").doc(playerRef.id), {
        playerId: playerRef.id,
        createdAt: approval.approvedAt,
      }, { merge: true });
    }

    projectedPlayers.push({
      playerId: playerRef.id,
      number: startingNumber + index,
      name: player.name,
      entryGroup: player.entryGroup,
    });
  }

  batch.set(tournamentRef.collection("playerRegistrationSubmissions").doc(submission.id), {
    status: "APPROVED",
    updatedAt: approval.approvedAt,
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
    entryGroups: buildApprovedEntryGroups(submission.players),
    approvedPlayers: projectedPlayers,
  }, { merge: true });

  await batch.commit();

  return {
    players: projectedPlayers,
    singleEventIds: singleEventDocs.map((doc) => doc.id),
  };
}
