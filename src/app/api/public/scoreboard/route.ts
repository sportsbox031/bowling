import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { getQuotaExceededMessage, isFirestoreQuotaExceededError } from "@/lib/firebase/quota";
import { getClientIp, rateLimitResponse } from "@/lib/api-utils";
import { publicRateLimiter } from "@/lib/rate-limit";
import { isValidFirestoreId } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rateLimit = publicRateLimiter.check(getClientIp(req));
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.remaining, rateLimit.resetMs);

  try {
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get("tournamentId");
    const eventId = url.searchParams.get("eventId");
    const divisionId = url.searchParams.get("divisionId") ?? undefined;

    if (!adminDb) {
      return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
    }
    if (!tournamentId || !eventId) {
      return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
    }
    if (!divisionId) {
      return NextResponse.json({ message: "DIVISION_ID_REQUIRED" }, { status: 400 });
    }

    const cacheKey = `scoreboard:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      const response = jsonCached(cached, 60);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const stored = await readEventScoreboardAggregate(adminDb, tournamentId, divisionId, eventId);
    if (stored && stored.eventRows.length > 0) {
      const result = {
        rows: stored.eventRows,
        ...(stored.teamRows ? { teamRows: stored.fivesCombinedRows ?? stored.teamRows } : {}),
        event: stored.event,
      };
      setCache(cacheKey, result, 60000);
      const response = jsonCached(result, 60);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const eventRef = adminDb.collection("tournaments").doc(tournamentId)
      .collection("divisions").doc(divisionId)
      .collection("events").doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const rebuilt = await rebuildEventScoreboardAggregate(adminDb, tournamentId, divisionId, eventId);
    const result = {
      rows: rebuilt.eventRows,
      ...(rebuilt.teamRows ? { teamRows: rebuilt.fivesCombinedRows ?? rebuilt.teamRows } : {}),
      event: rebuilt.event,
    };
    setCache(cacheKey, result, 60000);
    const response = jsonCached(result, 60);
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    return response;
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("점수표를 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { message: "LEADERBOARD_FAILED" },
      { status: 500 },
    );
  }
}
