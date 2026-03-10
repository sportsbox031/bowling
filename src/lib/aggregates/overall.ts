import type { Firestore } from "firebase-admin/firestore";
import { buildEventLeaderboard, buildOverallLeaderboard, type EventRankingResult } from "@/lib/scoring";

export type OverallAggregatePayload = {
  rows: ReturnType<typeof buildOverallLeaderboard>["rows"];
  eventTitleMap: Record<string, string>;
  updatedAt: string;
  tournamentId: string;
  divisionId: string | null;
};

const mapScoreDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot, tournamentId: string, eventId: string) => {
  const data = doc.data();
  return {
    id: doc.id,
    tournamentId,
    eventId,
    playerId: data.playerId,
    gameNumber: data.gameNumber,
    laneNumber: data.laneNumber ?? 0,
    score: data.score,
    createdAt: data.updatedAt ?? new Date().toISOString(),
  };
};

const getAggregateRef = (db: Firestore, tournamentId: string, divisionId?: string) => {
  if (divisionId) {
    return db.doc(`tournaments/${tournamentId}/divisions/${divisionId}/aggregates/overall`);
  }

  return db.doc(`tournaments/${tournamentId}/aggregates/overall`);
};

export async function computeOverallAggregate(db: Firestore, tournamentId: string, divisionId?: string): Promise<OverallAggregatePayload> {
  const [divisionSnap, playersSnap] = await Promise.all([
    db.collection("tournaments").doc(tournamentId).collection("divisions").get(),
    db.collection("tournaments").doc(tournamentId).collection("players").get(),
  ]);

  let divisionIds = divisionSnap.docs.map((doc) => doc.id);
  if (divisionId) {
    divisionIds = divisionIds.filter((id) => id === divisionId);
  }

  const allPlayers = playersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .filter((player: any) => !divisionId || player.divisionId === divisionId);

  const eventRowsByEventId: Record<string, EventRankingResult["rows"]> = {};
  const eventTitleMap: Record<string, string> = {};

  const eventGroups = (
    await Promise.all(
      divisionIds.map((targetDivisionId) =>
        db.collection("tournaments").doc(tournamentId)
          .collection("divisions").doc(targetDivisionId)
          .collection("events").get()
          .then((snap) => snap.docs.map((doc) => ({ doc, divisionId: targetDivisionId }))),
      ),
    )
  ).flat();

  const scoreResults = await Promise.all(
    eventGroups.map(async ({ doc: eventDoc, divisionId: targetDivisionId }) => {
      const eventData = eventDoc.data() ?? {};
      eventTitleMap[eventDoc.id] = String(eventData.title ?? eventDoc.id);
      const scoresSnap = await eventDoc.ref.collection("scores").get();
      const playersForEvent = allPlayers.filter((player: any) => player.divisionId === targetDivisionId);
      const scores = scoresSnap.docs.map((scoreDoc) => mapScoreDoc(scoreDoc, tournamentId, eventDoc.id));
      const leaderboard = buildEventLeaderboard({
        players: playersForEvent,
        scores,
        gameCount: Number(eventData.gameCount ?? 1),
      });
      return { eventId: eventDoc.id, rows: leaderboard.rows };
    }),
  );

  for (const { eventId, rows } of scoreResults) {
    eventRowsByEventId[eventId] = rows;
  }

  const overall = buildOverallLeaderboard({
    playerIds: allPlayers.map((player: any) => player.id),
    eventRowsByEventId,
  });

  return {
    rows: overall.rows,
    eventTitleMap,
    updatedAt: new Date().toISOString(),
    tournamentId,
    divisionId: divisionId ?? null,
  };
}

export async function rebuildOverallAggregate(db: Firestore, tournamentId: string, divisionId?: string): Promise<OverallAggregatePayload> {
  const payload = await computeOverallAggregate(db, tournamentId, divisionId);
  await getAggregateRef(db, tournamentId, divisionId).set(payload);
  return payload;
}

export async function readOverallAggregate(db: Firestore, tournamentId: string, divisionId?: string): Promise<OverallAggregatePayload | null> {
  const snap = await getAggregateRef(db, tournamentId, divisionId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    rows: Array.isArray(data.rows) ? (data.rows as OverallAggregatePayload["rows"]) : [],
    eventTitleMap: typeof data.eventTitleMap === "object" && data.eventTitleMap ? (data.eventTitleMap as Record<string, string>) : {},
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    tournamentId: typeof data.tournamentId === "string" ? data.tournamentId : tournamentId,
    divisionId: typeof data.divisionId === "string" ? data.divisionId : null,
  };
}
