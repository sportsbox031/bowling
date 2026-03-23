import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readOverallAggregate, rebuildOverallAggregate } from "@/lib/aggregates/overall";
import { getQuotaExceededMessage, isFirestoreQuotaExceededError } from "@/lib/firebase/quota";
import { getClientIp, rateLimitResponse } from "@/lib/api-utils";
import { publicRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rateLimit = publicRateLimiter.check(getClientIp(req));
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.remaining, rateLimit.resetMs);

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  try {
    const query = new URL(req.url).searchParams;
    const tournamentId = query.get("tournamentId");
    const divisionId = query.get("divisionId") ?? undefined;

    if (!tournamentId) {
      return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
    }

    const cacheKey = `overall:${tournamentId}:${divisionId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      const response = jsonCached(cached, 60);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const stored = await readOverallAggregate(adminDb, tournamentId, divisionId);
    if (stored && stored.rows.length > 0 && !stored.stale) {
      setCache(cacheKey, stored, 60000);
      const response = jsonCached(stored, 60);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const rebuilt = await rebuildOverallAggregate(adminDb, tournamentId, divisionId);
    setCache(cacheKey, rebuilt, 60000);
    const response = jsonCached(rebuilt, 60);
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    return response;
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("종합순위를 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json({ message: "OVERALL_FETCH_FAILED" }, { status: 500 });
  }
}
