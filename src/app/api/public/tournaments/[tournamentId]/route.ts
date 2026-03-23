import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readPublicTournamentAggregate, rebuildPublicTournamentAggregate } from "@/lib/aggregates/public-tournament";
import { getQuotaExceededMessage, isFirestoreQuotaExceededError } from "@/lib/firebase/quota";
import { getClientIp, rateLimitResponse } from "@/lib/api-utils";
import { publicRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const rateLimit = publicRateLimiter.check(getClientIp(req));
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.remaining, rateLimit.resetMs);

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  try {
    const tournamentId = ctx.params.tournamentId;
    if (!tournamentId?.trim()) {
      return NextResponse.json({ message: "INVALID_TOURNAMENT_ID" }, { status: 400 });
    }

    const cacheKey = `pub-tournament:${tournamentId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      const response = jsonCached(cached, 60);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const stored = await readPublicTournamentAggregate(adminDb, tournamentId);
    if (stored) {
      const result = {
        tournament: stored.tournament,
        divisions: stored.divisions,
        eventsByDivision: stored.eventsByDivision,
      };
      setCache(cacheKey, result, 60000);
      const response = jsonCached(result, 60);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const rebuilt = await rebuildPublicTournamentAggregate(adminDb, tournamentId);
    const result = {
      tournament: rebuilt.tournament,
      divisions: rebuilt.divisions,
      eventsByDivision: rebuilt.eventsByDivision,
    };
    setCache(cacheKey, result, 60000);
    const response = jsonCached(result, 60);
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    return response;
  } catch (error) {
    if ((error as Error).message === "TOURNAMENT_NOT_FOUND") {
      return NextResponse.json({ message: "TOURNAMENT_NOT_FOUND" }, { status: 404 });
    }
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("대회 정보를 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json({ message: "TOURNAMENT_FETCH_FAILED" }, { status: 500 });
  }
}
