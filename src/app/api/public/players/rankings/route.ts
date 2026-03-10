import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readPlayerRankingsAggregate, rebuildPlayerRankingsAggregate, type PlayerRankingAggregateRow } from "@/lib/aggregates/player-rankings";

export const dynamic = "force-dynamic";


export async function GET(_req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const cacheKey = "players-rankings-all";
  const cached = getCached<{ players: PlayerRankingAggregateRow[]; updatedAt?: string }>(cacheKey);
  if (cached) {
    return jsonCached(cached, 300);
  }

  const stored = await readPlayerRankingsAggregate(adminDb);
  if (stored && stored.players.length > 0) {
    setCache(cacheKey, stored, 300000);
    return jsonCached(stored, 300);
  }

  const rebuilt = await rebuildPlayerRankingsAggregate(adminDb);
  setCache(cacheKey, rebuilt, 300000);

  return jsonCached(rebuilt, 300);
}


