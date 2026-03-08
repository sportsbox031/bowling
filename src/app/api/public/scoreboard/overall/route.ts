import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard, buildOverallLeaderboard } from "@/lib/scoring";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";

export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const query = new URL(req.url).searchParams;
  const tournamentId = query.get("tournamentId");
  const divisionId = query.get("divisionId") ?? undefined;

  if (!tournamentId) {
    return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
  }

  const cacheKey = `overall:${tournamentId}:${divisionId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    return jsonCached(cached, 60);
  }

  const [divisionSnap, playersSnap] = await Promise.all([
    adminDb
      .collection("tournaments")
      .doc(tournamentId)
      .collection("divisions")
      .get(),
    adminDb
      .collection("tournaments")
      .doc(tournamentId)
      .collection("players")
      .get(),
  ]);

  let divisionIds = divisionSnap.docs.map((doc) => doc.id);
  if (divisionId) {
    divisionIds = divisionIds.filter((item) => item === divisionId);
  }

  const allPlayers = playersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .filter((player: any) => !divisionId || player.divisionId === divisionId);

  const eventRowsByEventId: Record<string, ReturnType<typeof buildEventLeaderboard>["rows"]> = {};

  // Fetch all events across divisions in parallel
  const eventsSnapPromises = divisionIds.map((targetDivId) =>
    adminDb!
      .collection("tournaments").doc(tournamentId)
      .collection("divisions").doc(targetDivId)
      .collection("events").get()
      .then((snap) => snap.docs.map((doc) => ({ doc, divisionId: targetDivId }))),
  );
  const eventsResults = (await Promise.all(eventsSnapPromises)).flat();

  // Fetch all scores across all events in parallel
  const scorePromises = eventsResults.map(({ doc: eventDoc, divisionId: targetDivId }) =>
    eventDoc.ref.collection("scores").get().then((scoresSnap) => {
      const playersForEvent = allPlayers.filter((player: any) => player.divisionId === targetDivId);
      const scores = scoresSnap.docs.map((scoreDoc) => {
        const data = scoreDoc.data();
        return {
          id: scoreDoc.id, tournamentId, eventId: eventDoc.id,
          playerId: data.playerId, gameNumber: data.gameNumber,
          laneNumber: data.laneNumber ?? 0, score: data.score,
          createdAt: data.updatedAt ?? new Date().toISOString(),
        };
      });
      const leaderboard = buildEventLeaderboard({ players: playersForEvent, scores });
      return { eventId: eventDoc.id, rows: leaderboard.rows };
    }),
  );
  const scoreResults = await Promise.all(scorePromises);
  for (const { eventId, rows } of scoreResults) {
    eventRowsByEventId[eventId] = rows;
  }

  const overall = buildOverallLeaderboard({
    playerIds: allPlayers.map((player: any) => player.id),
    eventRowsByEventId,
  });

  setCache(cacheKey, overall, 60000);

  return jsonCached(overall, 60);
}
