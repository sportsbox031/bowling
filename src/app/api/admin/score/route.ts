import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { getEventRefOrThrow } from "@/lib/firebase/eventPath";
import { invalidateCache } from "@/lib/api-cache";
import { rebuildPlayerRankingsAggregate, readPlayerRankingsAggregate } from "@/lib/aggregates/player-rankings";
import { rebuildOverallAggregate } from "@/lib/aggregates/overall";
import { rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { rebuildPlayerProfileAggregate, readPlayerProfileAggregate } from "@/lib/aggregates/player-profile";
import { isAggregateFresh } from "@/lib/aggregates/freshness";

const MAX_SCORE = 300;
const PLAYER_RANKINGS_MAX_AGE_MS = 5 * 60 * 1000;
const PLAYER_PROFILE_MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      tournamentId,
      eventId,
      divisionId,
      playerId,
      gameNumber,
      score,
      laneNumber,
    } = body ?? {};

    if (!adminDb) {
      return NextResponse.json({ message: "ADMIN_FIRESTORE_NOT_READY" }, { status: 503 });
    }

    if (
      !tournamentId ||
      !eventId ||
      !playerId ||
      !Number.isFinite(score) ||
      !Number.isInteger(score) ||
      !Number.isFinite(gameNumber) ||
      !Number.isInteger(gameNumber) ||
      gameNumber < 1 ||
      gameNumber > 6
    ) {
      return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (!Number.isFinite(laneNumber)) {
      return NextResponse.json({ message: "INVALID_LANE" }, { status: 400 });
    }

    if (score < 0 || score > MAX_SCORE) {
      return NextResponse.json({ message: "INVALID_SCORE" }, { status: 400 });
    }

    const eventInfo = await getEventRefOrThrow(tournamentId, eventId, divisionId);
    if (!eventInfo) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }
    const eventSnap = await eventInfo.ref.get();
    const eventData = eventSnap.data() ?? {};
    const eventLaneStart = Number(eventData.laneStart ?? 0);
    const eventLaneEnd = Number(eventData.laneEnd ?? 0);
    const normalizedLaneNumber = Number(laneNumber);
    if (normalizedLaneNumber > 0 && Number.isFinite(eventLaneStart) && Number.isFinite(eventLaneEnd)) {
      if (normalizedLaneNumber < eventLaneStart || normalizedLaneNumber > eventLaneEnd) {
        return NextResponse.json({ message: "INVALID_LANE" }, { status: 400 });
      }
    } else if (normalizedLaneNumber <= 0) {
      return NextResponse.json({ message: "INVALID_LANE" }, { status: 400 });
    }

    const normalizedPlayerId = String(playerId);
    const playerRef = adminDb
      .collection("tournaments")
      .doc(tournamentId)
      .collection("players")
      .doc(normalizedPlayerId);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      return NextResponse.json({ message: "PLAYER_NOT_FOUND" }, { status: 400 });
    }
    const playerData = playerDoc.data() ?? {};
    if (playerData?.divisionId !== eventInfo.divisionId) {
      return NextResponse.json({ message: "PLAYER_DIVISION_MISMATCH" }, { status: 400 });
    }

    const scoreRef = eventInfo.ref
      .collection("scores")
      .doc(`${normalizedPlayerId}_${gameNumber}`);

    await scoreRef.set({
      playerId: normalizedPlayerId,
      gameNumber: Number(gameNumber),
      score: Math.max(0, Number(score)),
      laneNumber: normalizedLaneNumber,
      updatedAt: new Date().toISOString(),
    });

    try {
      const rebuildTasks: Promise<unknown>[] = [
        rebuildOverallAggregate(adminDb, tournamentId, eventInfo.divisionId),
        rebuildOverallAggregate(adminDb, tournamentId),
        rebuildEventScoreboardAggregate(adminDb, tournamentId, eventInfo.divisionId, eventId),
      ];

      const existingRankings = await readPlayerRankingsAggregate(adminDb);
      if (!isAggregateFresh(existingRankings?.updatedAt, PLAYER_RANKINGS_MAX_AGE_MS)) {
        rebuildTasks.push(rebuildPlayerRankingsAggregate(adminDb));
      }

      const playerShortId = typeof playerData.shortId === "string" && playerData.shortId ? playerData.shortId : undefined;
      const playerName = typeof playerData.name === "string" ? playerData.name : undefined;
      const existingProfile = await readPlayerProfileAggregate(adminDb, playerShortId, playerName);
      if (!isAggregateFresh(existingProfile?.updatedAt, PLAYER_PROFILE_MAX_AGE_MS)) {
        rebuildTasks.push(rebuildPlayerProfileAggregate(adminDb, playerShortId, playerName));
      }

      if (typeof eventData.linkedEventId === "string" && eventData.linkedEventId) {
        rebuildTasks.push(rebuildEventScoreboardAggregate(adminDb, tournamentId, eventInfo.divisionId, eventData.linkedEventId));
      }
      await Promise.all(rebuildTasks);
    } catch (aggregateError) {
      console.error("AGGREGATE_REBUILD_FAILED", aggregateError);
    }

    invalidateCache(`scoreboard:${tournamentId}`);
    invalidateCache(`overall:${tournamentId}`);
    invalidateCache(`bundle-scores:${tournamentId}`);
    invalidateCache(`bundle-full:${tournamentId}`);
    invalidateCache("players-rankings-all");

    return NextResponse.json({ message: "SCORE_SAVED" });
  } catch (error) {
    return NextResponse.json(
      { message: "SCORE_SAVE_FAILED", error: String((error as Error).message) },
      { status: 500 },
    );
  }
}
