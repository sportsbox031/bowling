import type { Firestore } from "firebase-admin/firestore";

export interface PlayerRankingAggregateRow {
  shortId: string;
  name: string;
  region: string;
  affiliation: string;
  totalScore: number;
  totalGames: number;
  average: number;
  tournamentCount: number;
  highGame: number;
  rank: number;
}

export interface PlayerRankingsAggregatePayload {
  players: PlayerRankingAggregateRow[];
  updatedAt: string;
  stale?: boolean;
  staleAt?: string;
}

type PlayerAggregateSeed = {
  shortId: string;
  name: string;
  regions: Set<string>;
  affiliations: Set<string>;
  totalScore: number;
  totalGames: number;
  highGame: number;
  tournamentIds: Set<string>;
};

export const PLAYER_RANKINGS_AGGREGATE_PATH = "aggregates/public-player-rankings";

export const buildPlayerRankingRows = (agg: Map<string, PlayerAggregateSeed>): PlayerRankingAggregateRow[] => {
  const players = Array.from(agg.values())
    .filter((entry) => entry.totalGames > 0)
    .map((entry) => ({
      shortId: entry.shortId,
      name: entry.name,
      region: Array.from(entry.regions).join(", "),
      affiliation: Array.from(entry.affiliations).join(", "),
      totalScore: entry.totalScore,
      totalGames: entry.totalGames,
      average: Math.round((entry.totalScore / entry.totalGames + Number.EPSILON) * 10) / 10,
      tournamentCount: entry.tournamentIds.size,
      highGame: entry.highGame,
      rank: 0,
    }))
    .sort((a, b) => b.average - a.average || b.totalScore - a.totalScore || a.name.localeCompare(b.name));

  players.forEach((player, index) => {
    player.rank = index + 1;
  });

  return players;
};

export async function computePlayerRankings(db: Firestore): Promise<PlayerRankingAggregateRow[]> {
  const tournamentsSnap = await db.collection("tournaments").get();
  const agg = new Map<string, PlayerAggregateSeed>();

  await Promise.all(
    tournamentsSnap.docs.map(async (tournamentDoc) => {
      const tournamentId = tournamentDoc.id;

      const [divisionsSnap, playersSnap] = await Promise.all([
        db.collection("tournaments").doc(tournamentId).collection("divisions").get(),
        db.collection("tournaments").doc(tournamentId).collection("players").get(),
      ]);

      const playerMap = new Map<string, { shortId: string; name: string; region: string; affiliation: string }>();
      for (const playerDoc of playersSnap.docs) {
        const data = playerDoc.data();
        playerMap.set(playerDoc.id, {
          shortId: String(data.shortId ?? ""),
          name: String(data.name ?? ""),
          region: String(data.region ?? ""),
          affiliation: String(data.affiliation ?? ""),
        });
      }

      const eventDocs = (
        await Promise.all(
          divisionsSnap.docs.map((divisionDoc) =>
            divisionDoc.ref.collection("events").get().then((snap) => snap.docs),
          ),
        )
      ).flat();

      const scoreSnaps = await Promise.all(eventDocs.map((eventDoc) => eventDoc.ref.collection("scores").get()));

      for (const scoreSnap of scoreSnaps) {
        for (const scoreDoc of scoreSnap.docs) {
          const scoreData = scoreDoc.data();
          const player = playerMap.get(String(scoreData.playerId ?? ""));
          if (!player) continue;

          const key = player.shortId || player.name;
          let entry = agg.get(key);
          if (!entry) {
            entry = {
              shortId: player.shortId,
              name: player.name,
              regions: new Set<string>(),
              affiliations: new Set<string>(),
              totalScore: 0,
              totalGames: 0,
              highGame: 0,
              tournamentIds: new Set<string>(),
            };
            agg.set(key, entry);
          }

          if (player.region) entry.regions.add(player.region);
          if (player.affiliation) entry.affiliations.add(player.affiliation);
          entry.tournamentIds.add(tournamentId);
          entry.totalScore += Number(scoreData.score ?? 0);
          entry.totalGames += 1;
          if (Number(scoreData.score ?? 0) > entry.highGame) {
            entry.highGame = Number(scoreData.score ?? 0);
          }
        }
      }
    }),
  );

  return buildPlayerRankingRows(agg);
}

export async function rebuildPlayerRankingsAggregate(db: Firestore): Promise<PlayerRankingsAggregatePayload> {
  const players = await computePlayerRankings(db);
  const payload: PlayerRankingsAggregatePayload = {
    players,
    updatedAt: new Date().toISOString(),
    stale: false,
  };

  await db.doc(PLAYER_RANKINGS_AGGREGATE_PATH).set(payload);
  return payload;
}

export async function markPlayerRankingsAggregateStale(db: Firestore): Promise<void> {
  const staleAt = new Date().toISOString();
  await db.doc(PLAYER_RANKINGS_AGGREGATE_PATH).set({
    stale: true,
    staleAt,
  }, { merge: true });
}

export async function readPlayerRankingsAggregate(db: Firestore): Promise<PlayerRankingsAggregatePayload | null> {
  const snap = await db.doc(PLAYER_RANKINGS_AGGREGATE_PATH).get();
  if (!snap.exists) return null;

  const data = snap.data() ?? {};
  return {
    players: Array.isArray(data.players) ? (data.players as PlayerRankingAggregateRow[]) : [],
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    stale: data.stale === true,
    staleAt: typeof data.staleAt === "string" ? data.staleAt : undefined,
  };
}
