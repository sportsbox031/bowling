import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard } from "@/lib/scoring";
import { getCached, setCache } from "@/lib/api-cache";

const KIND_LABELS: Record<string, string> = {
  SINGLE: "개인전",
  DOUBLES: "2인조",
  TRIPLES: "3인조",
  FOURS: "4인조",
  FIVES: "5인조",
  OVERALL: "개인종합",
};

interface EventRecord {
  eventId: string;
  eventTitle: string;
  kind: string;
  kindLabel: string;
  gameScores: { gameNumber: number; score: number | null }[];
  total: number;
  average: number;
  rank: number;
  playerCount: number;
}

interface TournamentRecord {
  tournamentId: string;
  tournamentTitle: string;
  startsAt: string;
  region: string;
  divisionTitle: string;
  overallTotal: number;
  overallAverage: number;
  overallGames: number;
  events: EventRecord[];
}

interface KindStat {
  kind: string;
  kindLabel: string;
  games: number;
  totalScore: number;
  average: number;
}

interface ProfileResponse {
  playerName: string;
  summary: {
    totalScore: number;
    totalGames: number;
    average: number;
    tournamentCount: number;
    eventCount: number;
    highGame: number;
    kindStats: KindStat[];
  };
  tournaments: TournamentRecord[];
}

export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const name = new URL(req.url).searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
  }

  const cacheKey = `player-profile:${name}`;
  const cached = getCached<ProfileResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const tournamentsSnap = await adminDb.collection("tournaments").orderBy("startsAt", "desc").get();

  const tournaments: TournamentRecord[] = [];
  let totalScore = 0;
  let totalGames = 0;
  let highGame = 0;
  let eventCount = 0;
  const kindAgg = new Map<string, { games: number; totalScore: number }>();

  for (const tDoc of tournamentsSnap.docs) {
    const tournamentId = tDoc.id;
    const tData = tDoc.data();

    const playersSnap = await adminDb
      .collection("tournaments")
      .doc(tournamentId)
      .collection("players")
      .where("name", "==", name)
      .get();

    if (playersSnap.empty) continue;

    // Player might be in multiple divisions of the same tournament
    const playerEntries = playersSnap.docs.map((d) => ({
      id: d.id,
      divisionId: d.data().divisionId as string,
    }));

    const divisionIds = [...new Set(playerEntries.map((p) => p.divisionId))];

    for (const divisionId of divisionIds) {
      const divDoc = await adminDb
        .collection("tournaments")
        .doc(tournamentId)
        .collection("divisions")
        .doc(divisionId)
        .get();

      const divisionTitle = divDoc.exists ? (divDoc.data()?.title ?? "") : "";

      const eventsSnap = await adminDb
        .collection("tournaments")
        .doc(tournamentId)
        .collection("divisions")
        .doc(divisionId)
        .collection("events")
        .get();

      const playerIdsInDiv = playerEntries
        .filter((p) => p.divisionId === divisionId)
        .map((p) => p.id);

      const events: EventRecord[] = [];
      let tournamentTotal = 0;
      let tournamentGames = 0;

      // Fetch all players in this division for ranking context
      const allDivPlayersSnap = await adminDb
        .collection("tournaments")
        .doc(tournamentId)
        .collection("players")
        .get();

      const allDivPlayers = allDivPlayersSnap.docs
        .filter((d) => d.data().divisionId === divisionId)
        .map((d) => ({
          id: d.id,
          tournamentId,
          divisionId,
          group: d.data().group ?? "",
          region: d.data().region ?? "",
          affiliation: d.data().affiliation ?? "",
          number: d.data().number ?? 0,
          name: d.data().name ?? "",
          hand: d.data().hand ?? "right",
          createdAt: d.data().createdAt ?? "",
        }));

      for (const eventDoc of eventsSnap.docs) {
        const eData = eventDoc.data();
        const scoresSnap = await eventDoc.ref.collection("scores").get();

        const allScores = scoresSnap.docs.map((sd) => {
          const s = sd.data();
          return {
            id: sd.id,
            tournamentId,
            eventId: eventDoc.id,
            playerId: s.playerId as string,
            gameNumber: s.gameNumber as number,
            laneNumber: (s.laneNumber ?? 0) as number,
            score: s.score as number,
            createdAt: (s.updatedAt ?? "") as string,
          };
        });

        // Check if our player has scores in this event
        const playerScores = allScores.filter((s) => playerIdsInDiv.includes(s.playerId));
        if (playerScores.length === 0) continue;

        // Build leaderboard for ranking context
        const leaderboard = buildEventLeaderboard({
          players: allDivPlayers,
          scores: allScores,
        });

        const playerRow = leaderboard.rows.find((r) => playerIdsInDiv.includes(r.playerId));
        if (!playerRow) continue;

        const kind = (eData.kind ?? "SINGLE") as string;
        const gameScores = playerRow.gameScores;

        events.push({
          eventId: eventDoc.id,
          eventTitle: eData.title ?? "",
          kind,
          kindLabel: KIND_LABELS[kind] ?? kind,
          gameScores,
          total: playerRow.total,
          average: playerRow.average,
          rank: playerRow.rank,
          playerCount: leaderboard.rows.length,
        });

        tournamentTotal += playerRow.total;
        const gamesPlayed = gameScores.filter((g) => g.score !== null).length;
        tournamentGames += gamesPlayed;
        eventCount += 1;

        // Kind stats
        const ka = kindAgg.get(kind) ?? { games: 0, totalScore: 0 };
        ka.games += gamesPlayed;
        ka.totalScore += playerRow.total;
        kindAgg.set(kind, ka);

        // High game
        for (const g of gameScores) {
          if (g.score !== null && g.score > highGame) {
            highGame = g.score;
          }
        }

        totalScore += playerRow.total;
        totalGames += gamesPlayed;
      }

      if (events.length > 0) {
        tournaments.push({
          tournamentId,
          tournamentTitle: tData.title ?? "",
          startsAt: tData.startsAt ?? "",
          region: tData.region ?? "",
          divisionTitle,
          overallTotal: tournamentTotal,
          overallAverage: tournamentGames > 0
            ? Math.round((tournamentTotal / tournamentGames + Number.EPSILON) * 10) / 10
            : 0,
          overallGames: tournamentGames,
          events,
        });
      }
    }
  }

  const kindStats: KindStat[] = Array.from(kindAgg.entries()).map(([kind, stat]) => ({
    kind,
    kindLabel: KIND_LABELS[kind] ?? kind,
    games: stat.games,
    totalScore: stat.totalScore,
    average: stat.games > 0
      ? Math.round((stat.totalScore / stat.games + Number.EPSILON) * 10) / 10
      : 0,
  }));

  const result: ProfileResponse = {
    playerName: name,
    summary: {
      totalScore,
      totalGames,
      average: totalGames > 0
        ? Math.round((totalScore / totalGames + Number.EPSILON) * 10) / 10
        : 0,
      tournamentCount: tournaments.length,
      eventCount,
      highGame,
      kindStats,
    },
    tournaments,
  };

  setCache(cacheKey, result, 10000);

  return NextResponse.json(result);
}
