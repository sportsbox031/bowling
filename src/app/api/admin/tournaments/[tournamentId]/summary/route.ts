import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard } from "@/lib/scoring";
import { getCached, setCache } from "@/lib/api-cache";

/**
 * 종합집계표 API
 * Returns per-division summary: event medal winners (1~4위) + overall medal tally
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { tournamentId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const { tournamentId } = ctx.params;
  const cacheKey = `summary:${tournamentId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Load tournament
  const tournamentDoc = await adminDb.collection("tournaments").doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    return NextResponse.json({ message: "TOURNAMENT_NOT_FOUND" }, { status: 404 });
  }
  const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() } as any;

  // Load all divisions
  const divisionsSnap = await adminDb
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").get();

  const divisions = divisionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  const divisionSummaries = [];

  for (const division of divisions) {
    // Load events for this division
    const eventsSnap = await adminDb
      .collection("tournaments").doc(tournamentId)
      .collection("divisions").doc(division.id)
      .collection("events").get();

    const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    // Load players for this division
    const playersSnap = await adminDb
      .collection("tournaments").doc(tournamentId)
      .collection("players").where("divisionId", "==", division.id).get();
    const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    // Build leaderboard for each event
    const eventMedals: {
      eventId: string;
      eventTitle: string;
      eventKind: string;
      winners: { rank: number; playerId: string; name: string; affiliation: string; region: string; total: number }[];
    }[] = [];

    for (const event of events) {
      const scoresSnap = await event.ref
        ? await adminDb
            .collection("tournaments").doc(tournamentId)
            .collection("divisions").doc(division.id)
            .collection("events").doc(event.id)
            .collection("scores").get()
        : await adminDb
            .collection("tournaments").doc(tournamentId)
            .collection("divisions").doc(division.id)
            .collection("events").doc(event.id)
            .collection("scores").get();

      const scores = scoresSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          tournamentId,
          eventId: event.id,
          playerId: d.playerId as string,
          gameNumber: d.gameNumber as number,
          laneNumber: (d.laneNumber ?? 0) as number,
          score: d.score as number,
          createdAt: (d.updatedAt ?? "") as string,
        };
      });

      const leaderboard = buildEventLeaderboard({ players, scores, gameCount: event.gameCount ?? 1 });
      const top4 = leaderboard.rows
        .filter((r) => r.total > 0)
        .slice(0, 4)
        .map((r) => ({
          rank: r.rank,
          playerId: r.playerId,
          name: r.name,
          affiliation: r.affiliation,
          region: r.region,
          total: r.total,
        }));

      eventMedals.push({
        eventId: event.id,
        eventTitle: event.title,
        eventKind: event.kind,
        winners: top4,
      });
    }

    divisionSummaries.push({
      divisionId: division.id,
      divisionTitle: division.title,
      gender: division.gender,
      eventMedals,
    });
  }

  const result = {
    tournament: {
      id: tournament.id,
      title: tournament.title,
      host: tournament.host,
      startsAt: tournament.startsAt,
      endsAt: tournament.endsAt,
    },
    divisions: divisionSummaries,
  };

  setCache(cacheKey, result, 15000);
  return NextResponse.json(result);
}

