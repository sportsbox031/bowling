import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { invalidateCache } from "@/lib/api-cache";
import { markOverallAggregateStale, rebuildOverallAggregate } from "@/lib/aggregates/overall";
import { rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { markPlayerProfileAggregateStale } from "@/lib/aggregates/player-profile";
import { readEventParticipantProfileRefreshTargets } from "@/lib/player-profile-refresh";

export async function POST(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "ADMIN_FIRESTORE_NOT_READY" }, { status: 503 });
  }

  try {
    const db = adminDb;
    const { tournamentId, divisionId, eventId } = ctx.params;
    const eventRef = db
      .collection("tournaments").doc(tournamentId)
      .collection("divisions").doc(divisionId)
      .collection("events").doc(eventId);

    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const eventData = eventSnap.data() ?? {};
    const profileTargets = await readEventParticipantProfileRefreshTargets(db, tournamentId, divisionId, eventId);

    const criticalTasks: Promise<unknown>[] = [
      rebuildEventScoreboardAggregate(db, tournamentId, divisionId, eventId),
      rebuildOverallAggregate(db, tournamentId, divisionId),
    ];

    if (typeof eventData.linkedEventId === "string" && eventData.linkedEventId) {
      criticalTasks.push(rebuildEventScoreboardAggregate(db, tournamentId, divisionId, eventData.linkedEventId));
    }

    const [eventAggregate, divisionOverall] = await Promise.all(criticalTasks).then((results) => [results[0], results[1]] as const);

    await Promise.all([
      markOverallAggregateStale(db, tournamentId),
      ...profileTargets.map((target) => markPlayerProfileAggregateStale(db, target.shortId, target.name)),
    ]);

    const rankRefreshedAt = new Date().toISOString();
    await eventRef.set({
      rankRefreshPending: false,
      rankRefreshedAt,
    }, { merge: true });

    invalidateCache(`bundle-scores:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`bundle-full:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`scoreboard:${tournamentId}`);
    invalidateCache(`overall:${tournamentId}`);
    invalidateCache("player-profile:");

    return NextResponse.json({
      message: "RANK_REFRESHED",
      rankRefreshPending: false,
      rankRefreshedAt,
      playerProfileRefreshCount: profileTargets.length,
      deferredGlobalAggregates: true,
      eventRows: (eventAggregate as Awaited<ReturnType<typeof rebuildEventScoreboardAggregate>>).eventRows,
      overallRows: (divisionOverall as Awaited<ReturnType<typeof rebuildOverallAggregate>>).rows,
      eventTitleMap: (divisionOverall as Awaited<ReturnType<typeof rebuildOverallAggregate>>).eventTitleMap,
      ...((eventAggregate as Awaited<ReturnType<typeof rebuildEventScoreboardAggregate>>).teamRows
        ? { teamRows: (eventAggregate as Awaited<ReturnType<typeof rebuildEventScoreboardAggregate>>).teamRows }
        : {}),
      ...((eventAggregate as Awaited<ReturnType<typeof rebuildEventScoreboardAggregate>>).fivesCombinedRows
        ? { fivesCombinedRows: (eventAggregate as Awaited<ReturnType<typeof rebuildEventScoreboardAggregate>>).fivesCombinedRows }
        : {}),
    });
  } catch (error) {
    console.error("[rank-refresh] RANK_REFRESH_FAILED", error);
    return NextResponse.json(
      { message: "RANK_REFRESH_FAILED" },
      { status: 500 },
    );
  }
}
