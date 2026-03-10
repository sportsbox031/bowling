import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readOverallAggregate, rebuildOverallAggregate } from "@/lib/aggregates/overall";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const query = new URL(req.url).searchParams;
  const tournamentId = query.get("tournamentId");
  const divisionId = query.get("divisionId") ?? undefined;

  if (!tournamentId) {
    return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
  }

  const cacheKey = `overall:${tournamentId}:${divisionId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    return jsonCached(cached, 60);
  }

  const stored = await readOverallAggregate(adminDb, tournamentId, divisionId);
  if (stored && stored.rows.length > 0) {
    setCache(cacheKey, stored, 60000);
    return jsonCached(stored, 60);
  }

  const rebuilt = await rebuildOverallAggregate(adminDb, tournamentId, divisionId);
  setCache(cacheKey, rebuilt, 60000);
  return jsonCached(rebuilt, 60);
}


