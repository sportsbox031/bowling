import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import {
  readPlayerRankingsAggregate,
  rebuildPlayerRankingsAggregate,
  type PlayerRankingsAggregatePayload,
} from "@/lib/aggregates/player-rankings";
import { getQuotaExceededMessage, isFirestoreQuotaExceededError } from "@/lib/firebase/quota";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  try {
    const cacheKey = "players-rankings-all";
    const cached = getCached<PlayerRankingsAggregatePayload>(cacheKey);
    if (cached) {
      return jsonCached(cached, 300);
    }

    const stored = await readPlayerRankingsAggregate(adminDb);
    if (stored && stored.players.length > 0 && !stored.stale) {
      setCache(cacheKey, stored, 300000);
      return jsonCached(stored, 300);
    }

    const rebuilt = await rebuildPlayerRankingsAggregate(adminDb);
    setCache(cacheKey, rebuilt, 300000);

    return jsonCached(rebuilt, 300);
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("선수 랭킹을 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json({ message: "PLAYER_RANKINGS_FETCH_FAILED" }, { status: 500 });
  }
}
