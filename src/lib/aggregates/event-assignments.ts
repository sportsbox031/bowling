import type { Firestore } from "firebase-admin/firestore";
import { sortAssignmentsByPosition } from "@/lib/assignment-position";

export type EventAssignmentsAggregatePayload = {
  assignments: Array<{
    playerId: string;
    gameNumber: number;
    laneNumber: number;
    position: number | null;
    squadId: string | null;
    playerName: string;
    playerNumber: number;
    affiliation: string;
    region: string;
  }>;
  squads: Array<{
    id: string;
    name: string;
  }>;
  event: {
    id: string;
    title: string;
    kind: string;
    gameCount: number;
    laneStart: number;
    laneEnd: number;
    tableShift: number;
  };
  updatedAt: string;
};

type AssignmentAggregateRow = EventAssignmentsAggregatePayload["assignments"][number];

const sortAggregateAssignments = (assignments: AssignmentAggregateRow[]): AssignmentAggregateRow[] =>
  sortAssignmentsByPosition(assignments.map((assignment) => ({
    ...assignment,
    position: assignment.position ?? undefined,
  }))).map((assignment) => ({
    ...assignment,
    position: assignment.position ?? null,
  }));

const getAggregateRef = (db: Firestore, tournamentId: string, divisionId: string, eventId: string) =>
  db.doc(`tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/aggregates/assignments`);

export async function computeEventAssignmentsAggregate(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
): Promise<EventAssignmentsAggregatePayload> {
  const eventRef = db.collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").doc(eventId);

  const [eventDoc, assignmentsSnap, playersSnap, squadsSnap] = await Promise.all([
    eventRef.get(),
    eventRef.collection("assignments").orderBy("gameNumber").get(),
    db.collection("tournaments").doc(tournamentId).collection("players").where("divisionId", "==", divisionId).get(),
    eventRef.collection("squads").get(),
  ]);

  if (!eventDoc.exists) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const eventData = eventDoc.data() ?? {};
  const playerMap = new Map<string, { name: string; number: number; affiliation: string; region: string }>();

  for (const doc of playersSnap.docs) {
    const data = doc.data();
    playerMap.set(doc.id, {
      name: String(data.name ?? ""),
      number: Number(data.number ?? 0),
      affiliation: String(data.affiliation ?? ""),
      region: String(data.region ?? ""),
    });
  }

  return {
    assignments: sortAggregateAssignments(assignmentsSnap.docs.map((doc) => {
      const data = doc.data();
      const player = playerMap.get(String(data.playerId ?? ""));
      return {
        playerId: String(data.playerId ?? ""),
        gameNumber: Number(data.gameNumber ?? 0),
        laneNumber: Number(data.laneNumber ?? 0),
        position: Number.isFinite(data.position) ? Number(data.position) : null,
        squadId: typeof data.squadId === "string" ? data.squadId : null,
        playerName: player?.name ?? "",
        playerNumber: player?.number ?? 0,
        affiliation: player?.affiliation ?? "",
        region: player?.region ?? "",
      };
    })),
    squads: squadsSnap.docs.map((doc) => ({
      id: doc.id,
      name: String(doc.data().name ?? doc.id),
    })),
    event: {
      id: eventId,
      title: String(eventData.title ?? ""),
      kind: String(eventData.kind ?? ""),
      gameCount: Number(eventData.gameCount ?? 0),
      laneStart: Number(eventData.laneStart ?? 0),
      laneEnd: Number(eventData.laneEnd ?? 0),
      tableShift: Number(eventData.tableShift ?? 0),
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function rebuildEventAssignmentsAggregate(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
): Promise<EventAssignmentsAggregatePayload> {
  const payload = await computeEventAssignmentsAggregate(db, tournamentId, divisionId, eventId);
  await getAggregateRef(db, tournamentId, divisionId, eventId).set(payload);
  return payload;
}

export async function readEventAssignmentsAggregate(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
): Promise<EventAssignmentsAggregatePayload | null> {
  const snap = await getAggregateRef(db, tournamentId, divisionId, eventId).get();
  if (!snap.exists) return null;

  const data = snap.data() ?? {};
  return {
    assignments: Array.isArray(data.assignments) ? data.assignments as EventAssignmentsAggregatePayload["assignments"] : [],
    squads: Array.isArray(data.squads) ? data.squads as EventAssignmentsAggregatePayload["squads"] : [],
    event: data.event as EventAssignmentsAggregatePayload["event"],
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}
