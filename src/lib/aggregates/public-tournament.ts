import type { Firestore } from "firebase-admin/firestore";

export interface PublicTournamentDivision {
  id: string;
  title: string;
  code?: string;
  ageLabel?: string;
  gender?: string;
}

export interface PublicTournamentEvent {
  id: string;
  title: string;
  kind: string;
  gameCount: number;
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
}

export interface PublicTournamentEventsByDivision {
  divisionId: string;
  events: PublicTournamentEvent[];
}

export interface PublicTournamentListItem extends Record<string, unknown> {
  id: string;
  title?: string;
  region?: string;
  seasonYear?: number;
  startsAt?: string;
}

export interface PublicTournamentAggregate {
  tournament: Record<string, unknown> & { id: string };
  divisions: PublicTournamentDivision[];
  eventsByDivision: PublicTournamentEventsByDivision[];
  updatedAt: string;
}

export interface PublicTournamentListAggregate {
  items: PublicTournamentListItem[];
  updatedAt: string;
}

const getAggregateRef = (db: Firestore, tournamentId: string) =>
  db.doc(`tournaments/${tournamentId}/aggregates/public-detail`);

const getListAggregateRef = (db: Firestore) =>
  db.doc("aggregates/public-tournaments-list");

const sortText = (value: string | undefined) => value ?? "";

export function buildPublicTournamentAggregatePayload(input: {
  tournamentId: string;
  tournament: Record<string, unknown>;
  divisions: PublicTournamentDivision[];
  eventsByDivision: PublicTournamentEventsByDivision[];
}): PublicTournamentAggregate {
  const divisions = [...input.divisions].sort((a, b) =>
    sortText(a.title).localeCompare(sortText(b.title), "ko"),
  );

  const eventsByDivision = divisions.map((division) => {
    const source = input.eventsByDivision.find((entry) => entry.divisionId === division.id);
    const events = [...(source?.events ?? [])].sort((a, b) =>
      sortText(a.scheduleDate).localeCompare(sortText(b.scheduleDate), "ko") ||
      sortText(a.title).localeCompare(sortText(b.title), "ko"),
    );

    return {
      divisionId: division.id,
      events,
    };
  });

  return {
    tournament: { id: input.tournamentId, ...input.tournament },
    divisions,
    eventsByDivision,
    updatedAt: new Date().toISOString(),
  };
}

export function buildPublicTournamentListAggregatePayload(items: PublicTournamentListItem[]): PublicTournamentListAggregate {
  const sortedItems = [...items].sort((a, b) =>
    sortText(b.startsAt as string | undefined).localeCompare(sortText(a.startsAt as string | undefined), "ko") ||
    sortText(a.title).localeCompare(sortText(b.title), "ko"),
  );

  return {
    items: sortedItems,
    updatedAt: new Date().toISOString(),
  };
}

export async function computePublicTournamentAggregate(db: Firestore, tournamentId: string): Promise<PublicTournamentAggregate> {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const tournamentDoc = await tournamentRef.get();
  if (!tournamentDoc.exists) {
    throw new Error("TOURNAMENT_NOT_FOUND");
  }

  const divisionsSnap = await tournamentRef.collection("divisions").orderBy("title").get();
  const divisions: PublicTournamentDivision[] = divisionsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  })) as PublicTournamentDivision[];

  const eventsByDivision = await Promise.all(
    divisions.map(async (division) => {
      const eventsSnap = await tournamentRef
        .collection("divisions")
        .doc(division.id)
        .collection("events")
        .orderBy("scheduleDate")
        .get();

      return {
        divisionId: division.id,
        events: eventsSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Record<string, unknown>),
        })) as PublicTournamentEvent[],
      };
    }),
  );

  return buildPublicTournamentAggregatePayload({
    tournamentId,
    tournament: tournamentDoc.data() as Record<string, unknown>,
    divisions,
    eventsByDivision,
  });
}

export async function computePublicTournamentListAggregate(db: Firestore): Promise<PublicTournamentListAggregate> {
  const snapshot = await db.collection("tournaments").orderBy("startsAt", "desc").get();
  const items = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  })) as PublicTournamentListItem[];

  return buildPublicTournamentListAggregatePayload(items);
}

export async function rebuildPublicTournamentAggregate(db: Firestore, tournamentId: string): Promise<PublicTournamentAggregate> {
  const payload = await computePublicTournamentAggregate(db, tournamentId);
  await getAggregateRef(db, tournamentId).set(payload);
  return payload;
}

export async function rebuildPublicTournamentListAggregate(db: Firestore): Promise<PublicTournamentListAggregate> {
  const payload = await computePublicTournamentListAggregate(db);
  await getListAggregateRef(db).set(payload);
  return payload;
}

export async function readPublicTournamentAggregate(db: Firestore, tournamentId: string): Promise<PublicTournamentAggregate | null> {
  const snap = await getAggregateRef(db, tournamentId).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as PublicTournamentAggregate;
}

export async function readPublicTournamentListAggregate(db: Firestore): Promise<PublicTournamentListAggregate | null> {
  const snap = await getListAggregateRef(db).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as PublicTournamentListAggregate;
}

export async function deletePublicTournamentAggregate(db: Firestore, tournamentId: string): Promise<void> {
  await getAggregateRef(db, tournamentId).delete();
}
