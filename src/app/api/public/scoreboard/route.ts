import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { resolveEventRef } from "@/lib/firebase/eventPath";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { getQuotaExceededMessage, isFirestoreQuotaExceededError } from "@/lib/firebase/quota";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    const cacheKey = `scoreboard:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      return jsonCached(cached, 60);
    }

    const event = await resolveEventRef(adminDb, tournamentId, eventId, divisionId);
    if (!event) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const stored = await readEventScoreboardAggregate(adminDb, tournamentId, event.divisionId, eventId);
    if (stored && stored.eventRows.length > 0) {
      const result = {
        rows: stored.eventRows,
        ...(stored.teamRows ? { teamRows: stored.fivesCombinedRows ?? stored.teamRows } : {}),
        event: stored.event,
      };
      setCache(cacheKey, result, 60000);
      return jsonCached(result, 60);
    }

    const rebuilt = await rebuildEventScoreboardAggregate(adminDb, tournamentId, event.divisionId, eventId);
    const result = {
      rows: rebuilt.eventRows,
      ...(rebuilt.teamRows ? { teamRows: rebuilt.fivesCombinedRows ?? rebuilt.teamRows } : {}),
      event: rebuilt.event,
    };
    setCache(cacheKey, result, 60000);
    return jsonCached(result, 60);
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("점수표를 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { message: "LEADERBOARD_FAILED", error: String((error as Error).message) },
      { status: 500 },
    );
  }
}
