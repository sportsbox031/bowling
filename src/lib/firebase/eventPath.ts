import type { Firestore } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";

export const resolveEventRef = async (
  db: Firestore,
  tournamentId: string,
  eventId: string,
  divisionId?: string,
) => {
  if (divisionId) {
    const direct = db
      .collection("tournaments")
      .doc(tournamentId)
      .collection("divisions")
      .doc(divisionId)
      .collection("events")
      .doc(eventId);

    const doc = await direct.get();
    if (doc.exists) {
      return { divisionId, ref: direct };
    }

    return null;
  }

  const divisionsSnap = await db.collection("tournaments").doc(tournamentId).collection("divisions").get();
  for (const division of divisionsSnap.docs) {
    const ref = db
      .collection("tournaments")
      .doc(tournamentId)
      .collection("divisions")
      .doc(division.id)
      .collection("events")
      .doc(eventId);

    const eventDoc = await ref.get();
    if (eventDoc.exists) {
      return { divisionId: division.id, ref };
    }
  }

  return null;
};

export const getEventRefOrThrow = async (
  tournamentId: string,
  eventId: string,
  divisionId?: string,
) => {
  if (!adminDb) {
    return null;
  }

  const found = await resolveEventRef(adminDb, tournamentId, eventId, divisionId);
  if (!found) {
    return null;
  }

  return found;
};
