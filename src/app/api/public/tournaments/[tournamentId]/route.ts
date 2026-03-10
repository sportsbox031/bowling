import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readPublicTournamentAggregate, rebuildPublicTournamentAggregate } from "@/lib/aggregates/public-tournament";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { tournamentId: string } }) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const tournamentId = ctx.params.tournamentId;
  if (!tournamentId?.trim()) {
    return NextResponse.json({ message: "INVALID_TOURNAMENT_ID" }, { status: 400 });
  }

  const cacheKey = `pub-tournament:${tournamentId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    return jsonCached(cached, 60);
  }

  const stored = await readPublicTournamentAggregate(adminDb, tournamentId);
  if (stored) {
    const result = {
      tournament: stored.tournament,
      divisions: stored.divisions,
      eventsByDivision: stored.eventsByDivision,
    };
    setCache(cacheKey, result, 60000);
    return jsonCached(result, 60);
  }

  try {
    const rebuilt = await rebuildPublicTournamentAggregate(adminDb, tournamentId);
    const result = {
      tournament: rebuilt.tournament,
      divisions: rebuilt.divisions,
      eventsByDivision: rebuilt.eventsByDivision,
    };
    setCache(cacheKey, result, 60000);
    return jsonCached(result, 60);
  } catch (error) {
    if ((error as Error).message === "TOURNAMENT_NOT_FOUND") {
      return NextResponse.json({ message: "TOURNAMENT_NOT_FOUND" }, { status: 404 });
    }
    throw error;
  }
}
