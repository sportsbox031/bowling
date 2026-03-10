import type { Firestore } from "firebase-admin/firestore";
import { buildEventLeaderboard, buildFivesLinkedLeaderboard, buildTeamLeaderboard } from "@/lib/scoring";
import type { EventType, Player, Team } from "@/lib/models";

const TEAM_EVENT_KINDS: EventType[] = ["DOUBLES", "TRIPLES", "FIVES"];

export type EventScoreboardAggregatePayload = {
  eventRows: ReturnType<typeof buildEventLeaderboard>["rows"];
  teamRows?: ReturnType<typeof buildTeamLeaderboard>["rows"];
  fivesCombinedRows?: ReturnType<typeof buildFivesLinkedLeaderboard>["rows"];
  event: {
    id: string;
    title: string;
    kind: string;
    gameCount: number;
    scheduleDate: string;
    laneStart: number;
    laneEnd: number;
    tableShift: number;
    linkedEventId: string | null;
    halfType: string | null;
  };
  updatedAt: string;
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

const getAggregateRef = (db: Firestore, tournamentId: string, divisionId: string, eventId: string) =>
  db.doc(`tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/aggregates/scoreboard`);

export async function computeEventScoreboardAggregate(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
): Promise<EventScoreboardAggregatePayload> {
  const eventRef = db.collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").doc(eventId);

  const [eventDoc, scoresSnap, playersSnap, teamsSnap] = await Promise.all([
    eventRef.get(),
    eventRef.collection("scores").get(),
    db.collection("tournaments").doc(tournamentId).collection("players").where("divisionId", "==", divisionId).get(),
    eventRef.collection("teams").get(),
  ]);

  if (!eventDoc.exists) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const eventData = eventDoc.data() ?? {};
  const players = playersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Player));
  const scores = scoresSnap.docs.map((doc) => mapScoreDoc(doc, tournamentId, eventId));
  const eventLeaderboard = buildEventLeaderboard({
    players,
    scores,
    gameCount: Number(eventData.gameCount ?? 1),
  });

  const result: EventScoreboardAggregatePayload = {
    eventRows: eventLeaderboard.rows,
    event: {
      id: eventId,
      title: String(eventData.title ?? ""),
      kind: String(eventData.kind ?? ""),
      gameCount: Number(eventData.gameCount ?? 1),
      scheduleDate: String(eventData.scheduleDate ?? ""),
      laneStart: Number(eventData.laneStart ?? 0),
      laneEnd: Number(eventData.laneEnd ?? 0),
      tableShift: Number(eventData.tableShift ?? 0),
      linkedEventId: typeof eventData.linkedEventId === "string" ? eventData.linkedEventId : null,
      halfType: typeof eventData.halfType === "string" ? eventData.halfType : null,
    },
    updatedAt: new Date().toISOString(),
  };

  const isTeamEvent = TEAM_EVENT_KINDS.includes(eventData.kind as EventType);
  const teams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));

  if (isTeamEvent && teams.length > 0) {
    const playerMap = new Map<string, Player>(players.map((player) => [player.id, player]));
    const teamRows = buildTeamLeaderboard({
      teams,
      playerMap,
      individualRows: eventLeaderboard.rows,
    }).rows;
    result.teamRows = teamRows;

    if (eventData.kind === "FIVES" && typeof eventData.linkedEventId === "string" && eventData.linkedEventId) {
      const linkedRef = db.collection("tournaments").doc(tournamentId)
        .collection("divisions").doc(divisionId)
        .collection("events").doc(eventData.linkedEventId);
      const [linkedDoc, linkedScoresSnap, linkedTeamsSnap] = await Promise.all([
        linkedRef.get(),
        linkedRef.collection("scores").get(),
        linkedRef.collection("teams").get(),
      ]);

      if (linkedDoc.exists && linkedTeamsSnap.size > 0) {
        const linkedData = linkedDoc.data() ?? {};
        const linkedScores = linkedScoresSnap.docs.map((doc) => mapScoreDoc(doc, tournamentId, String(eventData.linkedEventId)));
        const linkedTeams = linkedTeamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));
        const linkedEventRows = buildEventLeaderboard({
          players,
          scores: linkedScores,
          gameCount: Number(linkedData.gameCount ?? 1),
        }).rows;
        const linkedTeamRows = buildTeamLeaderboard({
          teams: linkedTeams,
          playerMap,
          individualRows: linkedEventRows,
        }).rows;
        const isFirstHalf = eventData.halfType === "FIRST";
        result.fivesCombinedRows = buildFivesLinkedLeaderboard({
          firstHalfRows: isFirstHalf ? teamRows : linkedTeamRows,
          secondHalfRows: isFirstHalf ? linkedTeamRows : teamRows,
        }).rows;
      }
    }
  }

  return result;
}

export async function rebuildEventScoreboardAggregate(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
): Promise<EventScoreboardAggregatePayload> {
  const payload = await computeEventScoreboardAggregate(db, tournamentId, divisionId, eventId);
  await getAggregateRef(db, tournamentId, divisionId, eventId).set(payload);
  return payload;
}

export async function readEventScoreboardAggregate(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId: string,
): Promise<EventScoreboardAggregatePayload | null> {
  const snap = await getAggregateRef(db, tournamentId, divisionId, eventId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    eventRows: Array.isArray(data.eventRows) ? data.eventRows as EventScoreboardAggregatePayload["eventRows"] : [],
    teamRows: Array.isArray(data.teamRows) ? data.teamRows as EventScoreboardAggregatePayload["teamRows"] : undefined,
    fivesCombinedRows: Array.isArray(data.fivesCombinedRows) ? data.fivesCombinedRows as EventScoreboardAggregatePayload["fivesCombinedRows"] : undefined,
    event: data.event as EventScoreboardAggregatePayload["event"],
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}
