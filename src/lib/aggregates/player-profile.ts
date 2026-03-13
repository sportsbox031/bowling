import type { Firestore } from "firebase-admin/firestore";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";

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
  stale?: boolean;
  staleAt?: string;
  shortId?: string;
  lookupName?: string;
}

type TournamentProfileResult = {
  tournamentId: string;
  tournamentData: Record<string, unknown>;
  divisionRecords: { divisionTitle: string; events: EventRecord[]; tournamentTotal: number; tournamentGames: number }[];
};

const buildProfileDocId = (shortId?: string, name?: string) => {
  if (shortId) return `sid:${encodeURIComponent(shortId)}`;
  if (name) return `name:${encodeURIComponent(name)}`;
  throw new Error("PROFILE_KEY_REQUIRED");
};

export const PLAYER_PROFILE_COLLECTION_PATH = "playerProfiles";

const getProfileRef = (db: Firestore, shortId?: string, name?: string) =>
  db.collection(PLAYER_PROFILE_COLLECTION_PATH).doc(buildProfileDocId(shortId, name));


export async function computePlayerProfileAggregate(db: Firestore, shortId?: string, name?: string): Promise<PlayerProfileAggregate> {
  if (!shortId && !name) {
    throw new Error("INVALID_QUERY");
  }

  const matchingPlayersSnap = shortId
    ? await db.collectionGroup("players").where("shortId", "==", shortId).get()
    : await db.collectionGroup("players").where("name", "==", name).get();

  const tournaments: TournamentRecord[] = [];
  let totalScore = 0;
  let totalGames = 0;
  let highGame = 0;
  let eventCount = 0;
  const kindAgg = new Map<string, { games: number; totalScore: number }>();

  const playerEntriesByTournament = new Map<string, { id: string; divisionId: string }[]>();
  for (const doc of matchingPlayersSnap.docs) {
    const tournamentId = doc.ref.parent.parent?.id;
    if (!tournamentId) continue;

    const list = playerEntriesByTournament.get(tournamentId) ?? [];
    list.push({
      id: doc.id,
      divisionId: String(doc.data().divisionId ?? ""),
    });
    playerEntriesByTournament.set(tournamentId, list);
  }

  const tournamentDocs = await Promise.all(
    Array.from(playerEntriesByTournament.keys()).map(async (tournamentId) => ({
      tournamentId,
      doc: await db.collection("tournaments").doc(tournamentId).get(),
    })),
  );

  const tournamentResults = await Promise.all(
    tournamentDocs.map(async ({ tournamentId, doc: tDoc }) => {
      if (!tDoc.exists) return null;
      const tData = (tDoc.data() ?? {}) as Record<string, unknown>;
      const playerEntries = playerEntriesByTournament.get(tournamentId) ?? [];
      const divisionIds = [...new Set(playerEntries.map((player) => player.divisionId))].filter(Boolean);
      if (divisionIds.length === 0) return null;

      const divisionResults = await Promise.all(
        divisionIds.map((divId) =>
          Promise.all([
            db.collection("tournaments").doc(tournamentId).collection("divisions").doc(divId).get(),
            db.collection("tournaments").doc(tournamentId).collection("divisions").doc(divId).collection("events").get(),
          ]).then(([divDoc, eventsSnap]) => ({ divId, divDoc, eventsSnap })),
        ),
      );

      const divisionRecords: { divisionTitle: string; events: EventRecord[]; tournamentTotal: number; tournamentGames: number }[] = [];

      for (const divId of divisionIds) {
        const playerIdsInDivision = playerEntries.filter((player) => player.divisionId === divId).map((player) => player.id);
        const divisionResult = divisionResults.find((result) => result.divId === divId);
        const divisionTitle = divisionResult?.divDoc.exists ? String(divisionResult.divDoc.data()?.title ?? "") : "";
        const events: EventRecord[] = [];
        let tournamentTotal = 0;
        let tournamentGames = 0;

        for (const eventDoc of divisionResult?.eventsSnap.docs ?? []) {
          const eventData = eventDoc.data();
          const aggregate = await readEventScoreboardAggregate(db, tournamentId, divId, eventDoc.id)
            .then((value) => value ?? rebuildEventScoreboardAggregate(db, tournamentId, divId, eventDoc.id));
          const playerRow = aggregate.eventRows.find((row) => playerIdsInDivision.includes(row.playerId));
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
            playerCount: aggregate.eventRows.length,
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

  const sortedTournamentResults = tournamentResults
    .filter((result): result is TournamentProfileResult => result !== null)
    .sort((a, b) =>
      String(b.tournamentData?.startsAt ?? "").localeCompare(String(a.tournamentData?.startsAt ?? ""), "ko"),
    );

  for (const tournamentResult of sortedTournamentResults) {
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
    stale: false,
    ...(shortId ? { shortId } : {}),
    ...(playerNameResolved ? { lookupName: playerNameResolved } : name ? { lookupName: name } : {}),
  };
}

export async function rebuildPlayerProfileAggregate(db: Firestore, shortId?: string, name?: string): Promise<PlayerProfileAggregate> {
  const payload = await computePlayerProfileAggregate(db, shortId, name);
  await getProfileRef(db, shortId, name).set(payload);
  return payload;
}

export async function markPlayerProfileAggregateStale(db: Firestore, shortId?: string, name?: string): Promise<void> {
  await getProfileRef(db, shortId, name).set({
    stale: true,
    staleAt: new Date().toISOString(),
  }, { merge: true });
}

export async function readPlayerProfileAggregate(db: Firestore, shortId?: string, name?: string): Promise<PlayerProfileAggregate | null> {
  const snap = await getProfileRef(db, shortId, name).get();
  if (!snap.exists) return null;
  return snap.data() as PlayerProfileAggregate;
}
