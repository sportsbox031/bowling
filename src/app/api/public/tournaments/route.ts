import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readPublicTournamentListAggregate, rebuildPublicTournamentListAggregate } from "@/lib/aggregates/public-tournament";
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
    const keyword = (query.get("q") ?? "").toLowerCase().trim();
    const yearParam = query.get("year");
    const year = yearParam ? Number(yearParam) : null;
    const region = (query.get("region") ?? "").toLowerCase().trim();

    const cacheKey = `pub-tournaments:${keyword}:${year}:${region}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      const response = jsonCached(cached, 60);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const stored = await readPublicTournamentListAggregate(adminDb);
    const source = stored ?? await rebuildPublicTournamentListAggregate(adminDb);

    const filtered = source.items.filter((t) => {
      if (year !== null && Number.isFinite(year) && t.seasonYear !== year) {
        return false;
      }
      if (region && typeof t.region === "string" && !t.region.toLowerCase().includes(region)) {
        return false;
      }
      if (keyword && typeof t.title === "string" && !t.title.toLowerCase().includes(keyword)) {
        return false;
      }
      return true;
    });

    const result = { items: filtered };
    setCache(cacheKey, result, 60000);
    const response = jsonCached(result, 60);
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    return response;
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("대회 정보를 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json({ message: "TOURNAMENTS_FETCH_FAILED" }, { status: 500 });
  }
}
