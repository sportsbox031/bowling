import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache } from "@/lib/api-cache";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { compareEventDisplay } from "@/lib/event-display-order";
import { toDoc, snapToDoc } from "@/lib/firebase/docUtils";

const FIVES_COMBINED_TITLE = "5인조 전반+후반 합계";

const buildIndividualWinners = (rows: Array<{
  rank: number;
  playerId: string;
  name: string;
  affiliation: string;
  region: string;
  total: number;
}>) => rows
  .filter((row) => row.rank > 0 && row.total > 0)
  .slice(0, 4)
  .map((row) => ({
    rank: row.rank,
    playerId: row.playerId,
    name: row.name,
    affiliation: row.affiliation,
    region: row.region,
    total: row.total,
  }));

const buildTeamWinners = (rows: Array<{
  rank: number;
  teamId: string;
  teamName: string;
  teamType: string;
  teamTotal: number;
  members: Array<{ affiliation: string; region: string }>;
}>) => rows
  .filter((row) => row.teamType === "NORMAL" && row.rank > 0 && row.teamTotal > 0)
  .slice(0, 4)
  .map((row) => ({
    rank: row.rank,
    playerId: row.teamId,
    name: row.teamName,
    affiliation: row.members[0]?.affiliation ?? row.teamName,
    region: row.members[0]?.region ?? "",
    total: row.teamTotal,
  }));

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
  const tournament = snapToDoc<{ title?: string; host?: string; startsAt?: string; endsAt?: string }>(tournamentDoc)!;

  // Load all divisions
  const divisionsSnap = await db
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").get();

  const divisions = divisionsSnap.docs.map(toDoc<{ title?: string; gender?: string; code?: string }>);

  const divisionSummaries = await Promise.all(
    divisions.map(async (division) => {
      const eventsSnap = await db
        .collection("tournaments").doc(tournamentId)
        .collection("divisions").doc(division.id)
        .collection("events").get();

      const eventMedals = (await Promise.all(
        eventsSnap.docs.map(async (eventDoc) => {
          const event = toDoc<{ title?: string; kind?: string; halfType?: string; hidden?: boolean; linkedEventId?: string; fivesConfig?: { firstHalfGameCount: number } }>(eventDoc);
          if (event.hidden === true) {
            return null;
          }
          const aggregate = await readEventScoreboardAggregate(db, tournamentId, division.id, event.id)
            .then((value) => value ?? rebuildEventScoreboardAggregate(db, tournamentId, division.id, event.id));

          if (event.kind === "FIVES" && event.halfType === "SECOND") {
            return null;
          }

          const winners = event.kind === "FIVES" && Array.isArray(aggregate.fivesCombinedRows) && aggregate.fivesCombinedRows.length > 0
            ? buildTeamWinners(aggregate.fivesCombinedRows)
            : event.kind === "DOUBLES" || event.kind === "TRIPLES" || event.kind === "FOURS"
              ? buildTeamWinners(aggregate.teamRows ?? [])
              : buildIndividualWinners(aggregate.eventRows);

          return {
            eventId: event.kind === "FIVES" && winners.length > 0 ? `combined:${event.id}` : event.id,
            eventTitle: event.kind === "FIVES" && winners.length > 0 ? FIVES_COMBINED_TITLE : String(event.title ?? ""),
            eventKind: String(event.kind ?? ""),
            halfType: typeof event.halfType === "string" ? event.halfType : null,
            winners,
          };
        }),
      ))
        .filter((event): event is NonNullable<typeof event> => Boolean(event))
        .sort((a, b) => compareEventDisplay(a, b));

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

