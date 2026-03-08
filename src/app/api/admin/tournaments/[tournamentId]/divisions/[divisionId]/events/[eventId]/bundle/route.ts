import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard, buildOverallLeaderboard } from "@/lib/scoring";
import { getCached, setCache } from "@/lib/api-cache";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Consolidated API: returns event, players, participants, squads,
 * assignments, event leaderboard, and overall leaderboard in a single call.
 *
 * Query params:
 *   ?only=scores        — only scores + overall (for polling on score/rank tabs)
 *   ?only=assignments   — only assignments (for polling on lane tab)
 *   (no param)          — full bundle (initial load)
 */

// Shared helpers
const mapScoreDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot, tournamentId: string, eventId: string) => {
  const d = doc.data();
  return {
    id: doc.id, tournamentId, eventId,
    playerId: d.playerId as string,
    gameNumber: d.gameNumber as number,
    laneNumber: (d.laneNumber ?? 0) as number,
    score: d.score as number,
    createdAt: (d.updatedAt ?? "") as string,
  };
};

const buildOverallForDivision = async (
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  currentEventId: string,
  currentEventRows: ReturnType<typeof buildEventLeaderboard>["rows"],
  players: any[],
) => {
  const eventRowsByEventId: Record<string, ReturnType<typeof buildEventLeaderboard>["rows"]> = {};
  eventRowsByEventId[currentEventId] = currentEventRows;

  const eventsSnap = await db
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").get();

  const otherEventDocs = eventsSnap.docs.filter((d) => d.id !== currentEventId);
  if (otherEventDocs.length > 0) {
    const otherScores = await Promise.all(
      otherEventDocs.map((ed) =>
        ed.ref.collection("scores").get().then((snap) => ({
          eventId: ed.id,
          scores: snap.docs.map((sd) => mapScoreDoc(sd, tournamentId, ed.id)),
        })),
      ),
    );
    for (const os of otherScores) {
      const lb = buildEventLeaderboard({ players, scores: os.scores });
      eventRowsByEventId[os.eventId] = lb.rows;
    }
  }

  return buildOverallLeaderboard({
    playerIds: players.map((p) => p.id),
    eventRowsByEventId,
  });
};

export async function GET(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const { tournamentId, divisionId, eventId } = ctx.params;
  const only = new URL(req.url).searchParams.get("only") ?? "";

  const eventRef = adminDb
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").doc(eventId);

  // --- Partial: assignments only (lane tab polling) ---
  if (only === "assignments") {
    const cacheKey = `bundle-assign:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const snap = await eventRef.collection("assignments").orderBy("gameNumber").get();
    const assignments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const result = { assignments };
    setCache(cacheKey, result, 10000);
    return NextResponse.json(result);
  }

  // --- Partial: scores only (score/rank tab polling) ---
  if (only === "scores") {
    const cacheKey = `bundle-scores:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [scoresSnap, playersSnap] = await Promise.all([
      eventRef.collection("scores").get(),
      adminDb.collection("tournaments").doc(tournamentId)
        .collection("players").where("divisionId", "==", divisionId).get(),
    ]);

    const players = playersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
    const scores = scoresSnap.docs.map((doc) => mapScoreDoc(doc, tournamentId, eventId));
    const eventLeaderboard = buildEventLeaderboard({ players, scores });
    const overall = await buildOverallForDivision(adminDb, tournamentId, divisionId, eventId, eventLeaderboard.rows, players);

    const result = { eventRows: eventLeaderboard.rows, overallRows: overall.rows };
    setCache(cacheKey, result, 10000);
    return NextResponse.json(result);
  }

  // --- Full bundle (initial load) ---
  const cacheKey = `bundle-full:${tournamentId}:${divisionId}:${eventId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [eventDoc, playersSnap, participantsSnap, squadsSnap, assignmentsSnap, scoresSnap] =
    await Promise.all([
      eventRef.get(),
      adminDb.collection("tournaments").doc(tournamentId)
        .collection("players").where("divisionId", "==", divisionId).orderBy("number").get(),
      eventRef.collection("participants").get(),
      eventRef.collection("squads").orderBy("createdAt").get(),
      eventRef.collection("assignments").orderBy("gameNumber").get(),
      eventRef.collection("scores").get(),
    ]);

  if (!eventDoc.exists) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const eventData = { id: eventDoc.id, ...eventDoc.data() } as any;
  const allPlayers = playersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
  const participants = participantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const squads = squadsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const assignments = assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const scores = scoresSnap.docs.map((doc) => mapScoreDoc(doc, tournamentId, eventId));

  const eventLeaderboard = buildEventLeaderboard({ players: allPlayers, scores });
  const overall = await buildOverallForDivision(adminDb, tournamentId, divisionId, eventId, eventLeaderboard.rows, allPlayers);

  const result = {
    event: eventData,
    players: allPlayers,
    participants,
    squads,
    assignments,
    eventRows: eventLeaderboard.rows,
    overallRows: overall.rows,
  };

  setCache(cacheKey, result, 15000);
  return NextResponse.json(result);
}
