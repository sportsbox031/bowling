import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";

interface PlayerAgg {
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

export async function GET(_req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const cacheKey = "players-rankings-all";
  const cached = getCached<{ players: PlayerAgg[] }>(cacheKey);
  if (cached) {
    return jsonCached(cached, 300);
  }

  const tournamentsSnap = await adminDb.collection("tournaments").get();

  // shortId (또는 이름 폴백) -> aggregated data
  const agg = new Map<string, {
    shortId: string;
    name: string;
    regions: Set<string>;
    affiliations: Set<string>;
    totalScore: number;
    totalGames: number;
    highGame: number;
    tournamentIds: Set<string>;
  }>();

  // Process all tournaments in parallel
  await Promise.all(
    tournamentsSnap.docs.map(async (tDoc) => {
      const tournamentId = tDoc.id;

      const [divisionsSnap, playersSnap] = await Promise.all([
        adminDb!.collection("tournaments").doc(tournamentId).collection("divisions").get(),
        adminDb!.collection("tournaments").doc(tournamentId).collection("players").get(),
      ]);

      const playerMap = new Map<string, { shortId: string; name: string; region: string; affiliation: string }>();
      for (const pDoc of playersSnap.docs) {
        const d = pDoc.data();
        playerMap.set(pDoc.id, {
          shortId: (d.shortId ?? "") as string,
          name: d.name,
          region: d.region ?? "",
          affiliation: d.affiliation ?? "",
        });
      }

      // Fetch all events across all divisions in parallel
      const allEventDocs = (
        await Promise.all(
          divisionsSnap.docs.map((divDoc) =>
            divDoc.ref.collection("events").get().then((snap) => snap.docs),
          ),
        )
      ).flat();

      // Fetch all scores across all events in parallel
      const allScoreSnaps = await Promise.all(
        allEventDocs.map((eventDoc) =>
          eventDoc.ref.collection("scores").get(),
        ),
      );

      // Process scores (single-threaded aggregation to avoid Map race conditions)
      for (const scoresSnap of allScoreSnaps) {
        for (const scoreDoc of scoresSnap.docs) {
          const sd = scoreDoc.data();
          const player = playerMap.get(sd.playerId);
          if (!player) continue;

          // shortId 우선, 없으면 이름으로 폴백 (마이그레이션 전 데이터)
          const key = player.shortId || player.name;
          let entry = agg.get(key);
          if (!entry) {
            entry = {
              shortId: player.shortId,
              name: player.name,
              regions: new Set(),
              affiliations: new Set(),
              totalScore: 0,
              totalGames: 0,
              highGame: 0,
              tournamentIds: new Set(),
            };
            agg.set(key, entry);
          }

          if (player.region) entry.regions.add(player.region);
          if (player.affiliation) entry.affiliations.add(player.affiliation);
          entry.tournamentIds.add(tournamentId);
          entry.totalScore += sd.score ?? 0;
          entry.totalGames += 1;
          if ((sd.score ?? 0) > entry.highGame) {
            entry.highGame = sd.score;
          }
        }
      }
    }),
  );

  const players: PlayerAgg[] = Array.from(agg.values())
    .filter((e) => e.totalGames > 0)
    .map((e) => ({
      shortId: e.shortId,
      name: e.name,
      region: Array.from(e.regions).join(", "),
      affiliation: Array.from(e.affiliations).join(", "),
      totalScore: e.totalScore,
      totalGames: e.totalGames,
      average: Math.round((e.totalScore / e.totalGames + Number.EPSILON) * 10) / 10,
      tournamentCount: e.tournamentIds.size,
      highGame: e.highGame,
      rank: 0,
    }))
    .sort((a, b) => b.average - a.average || b.totalScore - a.totalScore);

  players.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  const result = { players };
  setCache(cacheKey, result, 300000);

  return jsonCached(result, 300);
}
