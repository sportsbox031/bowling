import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readPlayerProfileAggregate, rebuildPlayerProfileAggregate, type PlayerProfileAggregate } from "@/lib/aggregates/player-profile";

export const dynamic = "force-dynamic";


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
  const cached = getCached<PlayerProfileAggregate>(cacheKey);
  if (cached) {
    return jsonCached(cached, 300);
  }

  const stored = await readPlayerProfileAggregate(adminDb, shortId, name);
  if (stored) {
    setCache(cacheKey, stored, 300000);
    return jsonCached(stored, 300);
  }

  const rebuilt = await rebuildPlayerProfileAggregate(adminDb, shortId, name);
  setCache(cacheKey, rebuilt, 300000);
  return jsonCached(rebuilt, 300);
}


