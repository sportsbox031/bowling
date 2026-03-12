import type { Firestore, WriteBatch } from "firebase-admin/firestore";

import { firestorePaths } from "@/lib/firebase/schema";

export type TeamMembershipRecord = {
  playerId: string;
  teamId: string;
  updatedAt: string;
};

export const getTeamMembersCollection = (
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
) => db.collection(firestorePaths.teamMembers(tournamentId, divisionId, eventId));

export const getTeamMemberRef = (
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
  playerId: string,
) => db.doc(firestorePaths.teamMember(tournamentId, divisionId, eventId, playerId));

export async function readTeamMemberships(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
  playerIds: string[],
): Promise<Map<string, TeamMembershipRecord>> {
  const uniqueIds = [...new Set(playerIds)].filter(Boolean);
  const docs = await Promise.all(
    uniqueIds.map((playerId) => getTeamMemberRef(db, tournamentId, divisionId, eventId, playerId).get()),
  );

  const result = new Map<string, TeamMembershipRecord>();
  docs.forEach((doc, index) => {
    if (!doc.exists) return;
    const playerId = uniqueIds[index];
    const data = doc.data() ?? {};
    result.set(playerId, {
      playerId,
      teamId: String(data.teamId ?? ""),
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    });
  });
  return result;
}

export async function hydrateMissingTeamMemberships(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
  playerIds: string[],
): Promise<Map<string, TeamMembershipRecord>> {
  const memberships = await readTeamMemberships(db, tournamentId, divisionId, eventId, playerIds);
  const missingIds = [...new Set(playerIds)].filter((playerId) => playerId && !memberships.has(playerId));
  if (missingIds.length === 0) {
    return memberships;
  }

  const teamsRef = db.collection(firestorePaths.teams(tournamentId, divisionId, eventId));
  const discovered = await Promise.all(
    missingIds.map(async (playerId) => {
      const snap = await teamsRef.where("memberIds", "array-contains", playerId).limit(1).get();
      const teamDoc = snap.docs[0];
      if (!teamDoc) return null;
      const data = teamDoc.data() ?? {};
      return {
        playerId,
        teamId: teamDoc.id,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
      } satisfies TeamMembershipRecord;
    }),
  );

  const found = discovered.filter(Boolean) as TeamMembershipRecord[];
  if (found.length === 0) {
    return memberships;
  }

  const batch = db.batch();
  found.forEach((record) => {
    batch.set(
      getTeamMemberRef(db, tournamentId, divisionId, eventId, record.playerId),
      record,
      { merge: true },
    );
    memberships.set(record.playerId, record);
  });
  await batch.commit();

  return memberships;
}

export function setTeamMemberships(
  batch: WriteBatch,
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
  teamId: string,
  playerIds: string[],
  updatedAt: string,
): void {
  [...new Set(playerIds)].filter(Boolean).forEach((playerId) => {
    batch.set(
      getTeamMemberRef(db, tournamentId, divisionId, eventId, playerId),
      { playerId, teamId, updatedAt },
    );
  });
}

export function deleteTeamMemberships(
  batch: WriteBatch,
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
  playerIds: string[],
): void {
  [...new Set(playerIds)].filter(Boolean).forEach((playerId) => {
    batch.delete(getTeamMemberRef(db, tournamentId, divisionId, eventId, playerId));
  });
}
