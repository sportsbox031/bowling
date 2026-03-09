import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard } from "@/lib/scoring";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";

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

  const params = new URL(req.url).searchParams;
  const shortId = params.get("shortId")?.trim();
  const name = params.get("name")?.trim();

  if (!shortId && !name) {
    return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
  }

  const cacheKey = shortId ? `player-profile:sid:${shortId}` : `player-profile:${name}`;
  const cached = getCached<ProfileResponse>(cacheKey);
  if (cached) {
    return jsonCached(cached, 300);
  }

  const tournamentsSnap = await adminDb.collection("tournaments").orderBy("startsAt", "desc").get();

  const tournaments: TournamentRecord[] = [];
  let totalScore = 0;
  let totalGames = 0;
  let highGame = 0;
  let eventCount = 0;
  const kindAgg = new Map<string, { games: number; totalScore: number }>();

  // Process all tournaments in parallel instead of sequential loop
  const tournamentResults = await Promise.all(
    tournamentsSnap.docs.map(async (tDoc) => {
      const tournamentId = tDoc.id;
      const tData = tDoc.data();

      // 1. Find player in this tournament (shortId 우선, 없으면 name 폴백)
      const playersCol = adminDb!
        .collection("tournaments")
        .doc(tournamentId)
        .collection("players");
      const playersSnap = shortId
        ? await playersCol.where("shortId", "==", shortId).get()
        : await playersCol.where("name", "==", name).get();

      if (playersSnap.empty) return null;

      const playerEntries = playersSnap.docs.map((d) => ({
        id: d.id,
        divisionId: d.data().divisionId as string,
      }));
      const divisionIds = [...new Set(playerEntries.map((p) => p.divisionId))];

      // 2. Fetch all needed data in parallel: divisions + all players + all events per division
      const [allPlayersSnap, ...divResults] = await Promise.all([
        adminDb!.collection("tournaments").doc(tournamentId)
          .collection("players").where("divisionId", "in", divisionIds).get(),
        ...divisionIds.map((divId) =>
          Promise.all([
            adminDb!.collection("tournaments").doc(tournamentId)
              .collection("divisions").doc(divId).get(),
            adminDb!.collection("tournaments").doc(tournamentId)
              .collection("divisions").doc(divId)
              .collection("events").get(),
          ]).then(([divDoc, eventsSnap]) => ({ divId, divDoc, eventsSnap })),
        ),
      ]);

      const allPlayersByDiv = new Map<string, any[]>();
      for (const pDoc of allPlayersSnap.docs) {
        const divId = pDoc.data().divisionId;
        const arr = allPlayersByDiv.get(divId) ?? [];
        arr.push({
          id: pDoc.id, tournamentId, divisionId: divId,
          group: pDoc.data().group ?? "", region: pDoc.data().region ?? "",
          affiliation: pDoc.data().affiliation ?? "", number: pDoc.data().number ?? 0,
          name: pDoc.data().name ?? "", hand: pDoc.data().hand ?? "right",
          createdAt: pDoc.data().createdAt ?? "",
        });
        allPlayersByDiv.set(divId, arr);
      }

      // 3. Fetch all scores across all events in parallel
      const allEventDocs = divResults.flatMap((dr) =>
        dr.eventsSnap.docs.map((ed) => ({ eventDoc: ed, divId: dr.divId, divTitle: dr.divDoc.exists ? (dr.divDoc.data()?.title ?? "") : "" })),
      );

      const scoresResults = await Promise.all(
        allEventDocs.map((e) =>
          e.eventDoc.ref.collection("scores").get().then((snap) => ({ ...e, scoresSnap: snap })),
        ),
      );

      // 4. Process results
      const divisionRecords: { divisionId: string; divisionTitle: string; events: EventRecord[]; tournamentTotal: number; tournamentGames: number }[] = [];

      for (const divId of divisionIds) {
        const playerIdsInDiv = playerEntries.filter((p) => p.divisionId === divId).map((p) => p.id);
        const allDivPlayers = allPlayersByDiv.get(divId) ?? [];
        const divScoreResults = scoresResults.filter((sr) => sr.divId === divId);
        const divTitle = divScoreResults[0]?.divTitle ?? "";
        const events: EventRecord[] = [];
        let tournamentTotal = 0;
        let tournamentGames = 0;

        for (const { eventDoc, scoresSnap } of divScoreResults) {
          const eData = eventDoc.data();
          const allScores = scoresSnap.docs.map((sd) => {
            const s = sd.data();
            return {
              id: sd.id, tournamentId, eventId: eventDoc.id,
              playerId: s.playerId as string, gameNumber: s.gameNumber as number,
              laneNumber: (s.laneNumber ?? 0) as number, score: s.score as number,
              createdAt: (s.updatedAt ?? "") as string,
            };
          });

          const playerScores = allScores.filter((s) => playerIdsInDiv.includes(s.playerId));
          if (playerScores.length === 0) continue;

          const leaderboard = buildEventLeaderboard({ players: allDivPlayers, scores: allScores, gameCount: eData.gameCount ?? 1 });
          const playerRow = leaderboard.rows.find((r) => playerIdsInDiv.includes(r.playerId));
          if (!playerRow) continue;

          const kind = (eData.kind ?? "SINGLE") as string;
          const gameScores = playerRow.gameScores;
          events.push({
            eventId: eventDoc.id, eventTitle: eData.title ?? "", kind,
            kindLabel: KIND_LABELS[kind] ?? kind, gameScores,
            total: playerRow.total, average: playerRow.average,
            rank: playerRow.rank, playerCount: leaderboard.rows.length,
          });

          tournamentTotal += playerRow.total;
          const gamesPlayed = gameScores.filter((g) => g.score !== null).length;
          tournamentGames += gamesPlayed;
        }

        if (events.length > 0) {
          divisionRecords.push({ divisionId: divId, divisionTitle: divTitle, events, tournamentTotal, tournamentGames });
        }
      }

      return divisionRecords.length > 0
        ? { tournamentId, tData, divisionRecords }
        : null;
    }),
  );

  // Aggregate results
  for (const tr of tournamentResults) {
    if (!tr) continue;
    for (const dr of tr.divisionRecords) {
      tournaments.push({
        tournamentId: tr.tournamentId,
        tournamentTitle: tr.tData.title ?? "",
        startsAt: tr.tData.startsAt ?? "",
        region: tr.tData.region ?? "",
        divisionTitle: dr.divisionTitle,
        overallTotal: dr.tournamentTotal,
        overallAverage: dr.tournamentGames > 0
          ? Math.round((dr.tournamentTotal / dr.tournamentGames + Number.EPSILON) * 10) / 10
          : 0,
        overallGames: dr.tournamentGames,
        events: dr.events,
      });

      for (const ev of dr.events) {
        eventCount += 1;
        totalScore += ev.total;
        const gamesPlayed = ev.gameScores.filter((g) => g.score !== null).length;
        totalGames += gamesPlayed;

        const ka = kindAgg.get(ev.kind) ?? { games: 0, totalScore: 0 };
        ka.games += gamesPlayed;
        ka.totalScore += ev.total;
        kindAgg.set(ev.kind, ka);

        for (const g of ev.gameScores) {
          if (g.score !== null && g.score > highGame) highGame = g.score;
        }
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

  // 실제 선수 이름 추출
  let playerNameResolved = name || "";
  if (!playerNameResolved && shortId) {
    // shortId로 조회 시, globalPlayers에서 이름 가져오기
    const gpSnap = await adminDb.collection("globalPlayers").doc(shortId).get();
    if (gpSnap.exists) {
      playerNameResolved = (gpSnap.data()?.name ?? shortId) as string;
    }
  }

  const result: ProfileResponse = {
    playerName: playerNameResolved,
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

  setCache(cacheKey, result, 300000);

  return jsonCached(result, 300);
}

