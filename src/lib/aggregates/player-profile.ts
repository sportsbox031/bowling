import type { Firestore } from "firebase-admin/firestore";
import { buildEventLeaderboard } from "@/lib/scoring";

const KIND_LABELS: Record<string, string> = {
  SINGLE: "개인전",
  DOUBLES: "2인조",
  TRIPLES: "3인조",
  FOURS: "4인조",
  FIVES: "5인조",
  OVERALL: "개인종합",
};

export interface EventRecord {
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

export interface TournamentRecord {
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

export interface KindStat {
  kind: string;
  kindLabel: string;
  games: number;
  totalScore: number;
  average: number;
}

export interface PlayerProfileAggregate {
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
  updatedAt: string;
  shortId?: string;
  lookupName?: string;
}

const buildProfileDocId = (shortId?: string, name?: string) => {
  if (shortId) return `sid:${encodeURIComponent(shortId)}`;
  if (name) return `name:${encodeURIComponent(name)}`;
  throw new Error("PROFILE_KEY_REQUIRED");
};

const getProfileRef = (db: Firestore, shortId?: string, name?: string) =>
  db.doc(`aggregates/playerProfiles/${buildProfileDocId(shortId, name)}`);

export async function computePlayerProfileAggregate(db: Firestore, shortId?: string, name?: string): Promise<PlayerProfileAggregate> {
  if (!shortId && !name) {
    throw new Error("INVALID_QUERY");
  }

  const tournamentsSnap = await db.collection("tournaments").orderBy("startsAt", "desc").get();

  const tournaments: TournamentRecord[] = [];
  let totalScore = 0;
  let totalGames = 0;
  let highGame = 0;
  let eventCount = 0;
  const kindAgg = new Map<string, { games: number; totalScore: number }>();

  const tournamentResults = await Promise.all(
    tournamentsSnap.docs.map(async (tDoc) => {
      const tournamentId = tDoc.id;
      const tData = tDoc.data();
      const playersCol = db.collection("tournaments").doc(tournamentId).collection("players");
      const playersSnap = shortId
        ? await playersCol.where("shortId", "==", shortId).get()
        : await playersCol.where("name", "==", name).get();

      if (playersSnap.empty) return null;

      const playerEntries = playersSnap.docs.map((doc) => ({
        id: doc.id,
        divisionId: String(doc.data().divisionId ?? ""),
      }));
      const divisionIds = [...new Set(playerEntries.map((player) => player.divisionId))].filter(Boolean);
      if (divisionIds.length === 0) return null;

      const [allPlayersSnap, ...divisionResults] = await Promise.all([
        db.collection("tournaments").doc(tournamentId)
          .collection("players").where("divisionId", "in", divisionIds).get(),
        ...divisionIds.map((divId) =>
          Promise.all([
            db.collection("tournaments").doc(tournamentId).collection("divisions").doc(divId).get(),
            db.collection("tournaments").doc(tournamentId).collection("divisions").doc(divId).collection("events").get(),
          ]).then(([divDoc, eventsSnap]) => ({ divId, divDoc, eventsSnap })),
        ),
      ]);

      const allPlayersByDivision = new Map<string, any[]>();
      for (const playerDoc of allPlayersSnap.docs) {
        const playerData = playerDoc.data();
        const divisionKey = String(playerData.divisionId ?? "");
        const list = allPlayersByDivision.get(divisionKey) ?? [];
        list.push({
          id: playerDoc.id,
          tournamentId,
          divisionId: divisionKey,
          group: playerData.group ?? "",
          region: playerData.region ?? "",
          affiliation: playerData.affiliation ?? "",
          number: playerData.number ?? 0,
          name: playerData.name ?? "",
          hand: playerData.hand ?? "right",
          createdAt: playerData.createdAt ?? "",
        });
        allPlayersByDivision.set(divisionKey, list);
      }

      const allEventDocs = divisionResults.flatMap((result) =>
        result.eventsSnap.docs.map((eventDoc) => ({
          eventDoc,
          divId: result.divId,
          divTitle: result.divDoc.exists ? String(result.divDoc.data()?.title ?? "") : "",
        })),
      );

      const scoreResults = await Promise.all(
        allEventDocs.map((event) =>
          event.eventDoc.ref.collection("scores").get().then((scoresSnap) => ({ ...event, scoresSnap })),
        ),
      );

      const divisionRecords: { divisionTitle: string; events: EventRecord[]; tournamentTotal: number; tournamentGames: number }[] = [];

      for (const divId of divisionIds) {
        const playerIdsInDivision = playerEntries.filter((player) => player.divisionId === divId).map((player) => player.id);
        const divisionPlayers = allPlayersByDivision.get(divId) ?? [];
        const divisionScoreResults = scoreResults.filter((result) => result.divId === divId);
        const divisionTitle = divisionScoreResults[0]?.divTitle ?? "";
        const events: EventRecord[] = [];
        let tournamentTotal = 0;
        let tournamentGames = 0;

        for (const { eventDoc, scoresSnap } of divisionScoreResults) {
          const eventData = eventDoc.data();
          const allScores = scoresSnap.docs.map((scoreDoc) => {
            const scoreData = scoreDoc.data();
            return {
              id: scoreDoc.id,
              tournamentId,
              eventId: eventDoc.id,
              playerId: scoreData.playerId as string,
              gameNumber: scoreData.gameNumber as number,
              laneNumber: (scoreData.laneNumber ?? 0) as number,
              score: scoreData.score as number,
              createdAt: (scoreData.updatedAt ?? "") as string,
            };
          });

          const playerScores = allScores.filter((score) => playerIdsInDivision.includes(score.playerId));
          if (playerScores.length === 0) continue;

          const leaderboard = buildEventLeaderboard({
            players: divisionPlayers,
            scores: allScores,
            gameCount: Number(eventData.gameCount ?? 1),
          });
          const playerRow = leaderboard.rows.find((row) => playerIdsInDivision.includes(row.playerId));
          if (!playerRow) continue;

          const kind = String(eventData.kind ?? "SINGLE");
          const gameScores = playerRow.gameScores;
          events.push({
            eventId: eventDoc.id,
            eventTitle: String(eventData.title ?? ""),
            kind,
            kindLabel: KIND_LABELS[kind] ?? kind,
            gameScores,
            total: playerRow.total,
            average: playerRow.average,
            rank: playerRow.rank,
            playerCount: leaderboard.rows.length,
          });

          tournamentTotal += playerRow.total;
          tournamentGames += gameScores.filter((game) => game.score !== null).length;
        }

        if (events.length > 0) {
          divisionRecords.push({
            divisionTitle,
            events,
            tournamentTotal,
            tournamentGames,
          });
        }
      }

      return divisionRecords.length > 0 ? { tournamentId, tournamentData: tData, divisionRecords } : null;
    }),
  );

  for (const tournamentResult of tournamentResults) {
    if (!tournamentResult) continue;
    for (const divisionRecord of tournamentResult.divisionRecords) {
      tournaments.push({
        tournamentId: tournamentResult.tournamentId,
        tournamentTitle: String(tournamentResult.tournamentData.title ?? ""),
        startsAt: String(tournamentResult.tournamentData.startsAt ?? ""),
        region: String(tournamentResult.tournamentData.region ?? ""),
        divisionTitle: divisionRecord.divisionTitle,
        overallTotal: divisionRecord.tournamentTotal,
        overallAverage: divisionRecord.tournamentGames > 0
          ? Math.round((divisionRecord.tournamentTotal / divisionRecord.tournamentGames + Number.EPSILON) * 10) / 10
          : 0,
        overallGames: divisionRecord.tournamentGames,
        events: divisionRecord.events,
      });

      for (const event of divisionRecord.events) {
        eventCount += 1;
        totalScore += event.total;
        const gamesPlayed = event.gameScores.filter((game) => game.score !== null).length;
        totalGames += gamesPlayed;

        const kindEntry = kindAgg.get(event.kind) ?? { games: 0, totalScore: 0 };
        kindEntry.games += gamesPlayed;
        kindEntry.totalScore += event.total;
        kindAgg.set(event.kind, kindEntry);

        for (const game of event.gameScores) {
          if (game.score !== null && game.score > highGame) {
            highGame = game.score;
          }
        }
      }
    }
  }

  const kindStats: KindStat[] = Array.from(kindAgg.entries()).map(([kind, stat]) => ({
    kind,
    kindLabel: KIND_LABELS[kind] ?? kind,
    games: stat.games,
    totalScore: stat.totalScore,
    average: stat.games > 0 ? Math.round((stat.totalScore / stat.games + Number.EPSILON) * 10) / 10 : 0,
  }));

  let playerNameResolved = name || "";
  if (!playerNameResolved && shortId) {
    const globalPlayerSnap = await db.collection("globalPlayers").doc(shortId).get();
    if (globalPlayerSnap.exists) {
      playerNameResolved = String(globalPlayerSnap.data()?.name ?? shortId);
    }
  }

  return {
    playerName: playerNameResolved,
    summary: {
      totalScore,
      totalGames,
      average: totalGames > 0 ? Math.round((totalScore / totalGames + Number.EPSILON) * 10) / 10 : 0,
      tournamentCount: tournaments.length,
      eventCount,
      highGame,
      kindStats,
    },
    tournaments,
    updatedAt: new Date().toISOString(),
    ...(shortId ? { shortId } : {}),
    ...(playerNameResolved ? { lookupName: playerNameResolved } : name ? { lookupName: name } : {}),
  };
}

export async function rebuildPlayerProfileAggregate(db: Firestore, shortId?: string, name?: string): Promise<PlayerProfileAggregate> {
  const payload = await computePlayerProfileAggregate(db, shortId, name);
  await getProfileRef(db, shortId, name).set(payload);
  return payload;
}

export async function readPlayerProfileAggregate(db: Firestore, shortId?: string, name?: string): Promise<PlayerProfileAggregate | null> {
  const snap = await getProfileRef(db, shortId, name).get();
  if (!snap.exists) return null;
  return snap.data() as PlayerProfileAggregate;
}
