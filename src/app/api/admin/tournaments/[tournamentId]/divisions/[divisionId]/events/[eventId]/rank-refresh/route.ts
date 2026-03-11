import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { invalidateCache } from "@/lib/api-cache";
import { rebuildOverallAggregate } from "@/lib/aggregates/overall";
import { rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { rebuildPlayerRankingsAggregate } from "@/lib/aggregates/player-rankings";
import { rebuildPlayerProfileAggregate } from "@/lib/aggregates/player-profile";
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
    const { tournamentId, divisionId, eventId } = ctx.params;
    const eventRef = adminDb
      .collection("tournaments").doc(tournamentId)
      .collection("divisions").doc(divisionId)
      .collection("events").doc(eventId);

    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const eventData = eventSnap.data() ?? {};
    const profileTargets = await readEventParticipantProfileRefreshTargets(adminDb, tournamentId, divisionId, eventId);

    const tasks: Promise<unknown>[] = [
      rebuildEventScoreboardAggregate(adminDb, tournamentId, divisionId, eventId),
      rebuildOverallAggregate(adminDb, tournamentId, divisionId),
      rebuildOverallAggregate(adminDb, tournamentId),
      rebuildPlayerRankingsAggregate(adminDb),
    ];

    if (typeof eventData.linkedEventId === "string" && eventData.linkedEventId) {
      tasks.push(rebuildEventScoreboardAggregate(adminDb, tournamentId, divisionId, eventData.linkedEventId));
    }

    const [eventAggregate, divisionOverall] = await Promise.all(tasks).then((results) => [results[0], results[1]] as const);

    for (const target of profileTargets) {
      await rebuildPlayerProfileAggregate(adminDb, target.shortId, target.name);
    }

    const rankRefreshedAt = new Date().toISOString();
    await eventRef.set({
      rankRefreshPending: false,
      rankRefreshedAt,
    }, { merge: true });

    invalidateCache(`bundle-scores:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`bundle-full:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`scoreboard:${tournamentId}`);
    invalidateCache(`overall:${tournamentId}`);
    invalidateCache("players-rankings-all");
    invalidateCache("player-profile:");

    return NextResponse.json({
      message: "RANK_REFRESHED",
      rankRefreshPending: false,
      rankRefreshedAt,
      playerProfileRefreshCount: profileTargets.length,
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
    return NextResponse.json(
      { message: "RANK_REFRESH_FAILED", error: String((error as Error).message) },
      { status: 500 },
    );
  }
}
