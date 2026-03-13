import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache } from "@/lib/api-cache";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";

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
  const db = adminDb;

  const { tournamentId } = ctx.params;
  const cacheKey = `summary:${tournamentId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Load tournament
  const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    return NextResponse.json({ message: "TOURNAMENT_NOT_FOUND" }, { status: 404 });
  }
  const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() } as any;

  // Load all divisions
  const divisionsSnap = await db
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").get();

  const divisions = divisionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  const divisionSummaries = await Promise.all(
    divisions.map(async (division) => {
      const eventsSnap = await db
        .collection("tournaments").doc(tournamentId)
        .collection("divisions").doc(division.id)
        .collection("events").get();

      const eventMedals = await Promise.all(
        eventsSnap.docs.map(async (eventDoc) => {
          const event = { id: eventDoc.id, ...eventDoc.data() } as any;
          const aggregate = await readEventScoreboardAggregate(db, tournamentId, division.id, event.id)
            .then((value) => value ?? rebuildEventScoreboardAggregate(db, tournamentId, division.id, event.id));

          const winners = aggregate.eventRows
            .filter((row) => row.total > 0)
            .slice(0, 4)
            .map((row) => ({
              rank: row.rank,
              playerId: row.playerId,
              name: row.name,
              affiliation: row.affiliation,
              region: row.region,
              total: row.total,
            }));

          return {
            eventId: event.id,
            eventTitle: String(event.title ?? ""),
            eventKind: String(event.kind ?? ""),
            winners,
          };
        }),
      );

      return {
        divisionId: division.id,
        divisionTitle: division.title,
        gender: division.gender,
        eventMedals,
      };
    }),
  );

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

