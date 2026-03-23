import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import {
  readEventAssignmentsAggregate,
  rebuildEventAssignmentsAggregate,
  type EventAssignmentsAggregatePayload,
} from "@/lib/aggregates/event-assignments";
import { sortAssignmentsByPosition } from "@/lib/assignment-position";
import { getQuotaExceededMessage, isFirestoreQuotaExceededError } from "@/lib/firebase/quota";
import { getClientIp, rateLimitResponse } from "@/lib/api-utils";
import { publicRateLimiter } from "@/lib/rate-limit";

const sortFilteredAssignments = (
  assignments: EventAssignmentsAggregatePayload["assignments"],
) =>
  sortAssignmentsByPosition(assignments.map((assignment) => ({
    ...assignment,
    position: assignment.position ?? undefined,
  }))).map((assignment) => ({
    ...assignment,
    position: assignment.position ?? null,
  }));

export async function GET(req: NextRequest) {
  const rateLimit = publicRateLimiter.check(getClientIp(req));
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.remaining, rateLimit.resetMs);

  try {
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get("tournamentId");
    const eventId = url.searchParams.get("eventId");
    const divisionId = url.searchParams.get("divisionId") ?? undefined;
    const squadId = url.searchParams.get("squadId") ?? undefined;

    if (!adminDb) {
      return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
    }
    if (!tournamentId || !eventId) {
      return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
    }
    if (!divisionId) {
      return NextResponse.json({ message: "DIVISION_ID_REQUIRED" }, { status: 400 });
    }

    const cacheKey = `pub-assignments:${tournamentId}:${divisionId}:${eventId}:${squadId ?? "all"}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      const response = jsonCached(cached, 30);
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      return response;
    }

    const aggregate = await readEventAssignmentsAggregate(adminDb, tournamentId, divisionId, eventId)
      ?? await rebuildEventAssignmentsAggregate(adminDb, tournamentId, divisionId, eventId);

    const result = {
      ...aggregate,
      assignments: squadId
        ? sortFilteredAssignments(aggregate.assignments.filter((assignment) => assignment.squadId === squadId))
        : aggregate.assignments,
    };

    setCache(cacheKey, result, 60000);
    const response = jsonCached(result, 30);
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    return response;
  } catch (error) {
    if ((error as Error).message === "EVENT_NOT_FOUND") {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("레인 배정을 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { message: "ASSIGNMENTS_FETCH_FAILED" },
      { status: 500 },
    );
  }
}



