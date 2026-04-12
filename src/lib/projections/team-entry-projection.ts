import type { Firestore } from "firebase-admin/firestore";
import { firestorePaths } from "@/lib/firebase/schema";
import type { TeamEntrySubmission } from "@/lib/models-user";
import { deriveTeamIdentity } from "@/lib/team-identity";
import { setTeamMemberships, hydrateMissingTeamMemberships } from "@/lib/admin/team-membership";
import { normalizeFivesLineups } from "@/lib/fives-lineup";

export type TeamEntryProjectionResult = {
  teamIds: string[];
  participantCount: number;
};

const getStartingMakeupTeamIndex = async (
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
) => {
  const snap = await db
    .collection(firestorePaths.teams(tournamentId, divisionId, eventId))
    .where("teamType", "==", "MAKEUP")
    .get();
  return snap.size + 1;
};

export async function applyApprovedTeamEntrySubmission(
  db: Firestore,
  submission: TeamEntrySubmission,
  approval: { approvedAt: string; approvedBy: string },
): Promise<TeamEntryProjectionResult> {
  const eventRef = db.doc(firestorePaths.event(submission.tournamentId, submission.divisionId, submission.eventId));
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const event = eventSnap.data() ?? {};
  const batch = db.batch();
  const teamIds: string[] = [];
  const allPlayerIds = [...new Set(submission.teams.flatMap((team) => team.playerIds))];
  let nextMakeupTeamIndex = await getStartingMakeupTeamIndex(
    db,
    submission.tournamentId,
    submission.divisionId,
    submission.eventId,
  );
  const memberships = await hydrateMissingTeamMemberships(
    db,
    submission.tournamentId,
    submission.divisionId,
    submission.eventId,
    allPlayerIds,
  );

  if ([...memberships.values()].some((membership) => membership.teamId)) {
    throw new Error("PLAYER_ALREADY_IN_EVENT_TEAM");
  }

  for (const team of submission.teams) {
    const players = await Promise.all(
      team.playerIds.map((playerId) => db.doc(firestorePaths.player(submission.tournamentId, playerId)).get()),
    );
    const identity = deriveTeamIdentity(
      players.map((player) => ({
        affiliation: String(player.data()?.affiliation ?? ""),
        group: String(player.data()?.group ?? ""),
      })),
      {
        eventKind: event.kind,
        requiredSize: typeof event.teamSize === "number" ? event.teamSize : team.playerIds.length,
      },
    );

    const teamRef = db.collection(firestorePaths.teams(submission.tournamentId, submission.divisionId, submission.eventId)).doc();
    const fallbackMakeupTeamName = `혼성팀 ${nextMakeupTeamIndex}`;
    const teamName = team.name?.trim()
      || identity.normalTeamName
      || fallbackMakeupTeamName;
    if (!team.name?.trim() && !identity.normalTeamName) {
      nextMakeupTeamIndex += 1;
    }

    const baseTeam = {
      tournamentId: submission.tournamentId,
      divisionId: submission.divisionId,
      eventId: submission.eventId,
      name: teamName,
      teamType: identity.teamType,
      memberIds: team.playerIds,
      createdAt: approval.approvedAt,
      updatedAt: approval.approvedAt,
    };

    if (event.kind === "FIVES") {
      const lineups = normalizeFivesLineups({
        rosterIds: team.playerIds,
        firstHalfMemberIds: team.firstHalfMemberIds ?? team.playerIds.slice(0, 5),
        secondHalfMemberIds: team.secondHalfMemberIds ?? team.firstHalfMemberIds ?? team.playerIds.slice(0, 5),
      });
      batch.set(teamRef, {
        ...baseTeam,
        memberIds: lineups.firstHalfMemberIds,
        rosterIds: lineups.rosterIds,
        firstHalfMemberIds: lineups.firstHalfMemberIds,
        secondHalfMemberIds: lineups.secondHalfMemberIds,
      });
      setTeamMemberships(batch, db, submission.tournamentId, submission.divisionId, submission.eventId, teamRef.id, lineups.rosterIds, approval.approvedAt);
      for (const playerId of lineups.rosterIds) {
        batch.set(
          db.collection("tournaments").doc(submission.tournamentId)
            .collection("divisions").doc(submission.divisionId)
            .collection("events").doc(submission.eventId)
            .collection("participants").doc(playerId),
          { playerId, createdAt: approval.approvedAt },
          { merge: true },
        );
      }
      teamIds.push(teamRef.id);
      continue;
    }

    batch.set(teamRef, baseTeam);
    setTeamMemberships(batch, db, submission.tournamentId, submission.divisionId, submission.eventId, teamRef.id, team.playerIds, approval.approvedAt);
    for (const playerId of team.playerIds) {
      batch.set(
        db.collection("tournaments").doc(submission.tournamentId)
          .collection("divisions").doc(submission.divisionId)
          .collection("events").doc(submission.eventId)
          .collection("participants").doc(playerId),
        { playerId, createdAt: approval.approvedAt },
        { merge: true },
      );
    }
    teamIds.push(teamRef.id);
  }

  batch.set(
    db.doc(firestorePaths.teamEntrySubmission(submission.tournamentId, submission.id)),
    {
      status: "APPROVED",
      updatedAt: approval.approvedAt,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
      projectedTeamIds: teamIds,
    },
    { merge: true },
  );

  await batch.commit();
  return {
    teamIds,
    participantCount: allPlayerIds.length,
  };
}
