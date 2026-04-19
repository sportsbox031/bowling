import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { getEventRefOrThrow } from "@/lib/firebase/eventPath";
import { invalidateCache } from "@/lib/api-cache";
import { rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { markOverallAggregateStale, rebuildOverallAggregate } from "@/lib/aggregates/overall";
import { isValidGameNumber, isValidScore } from "@/lib/validation";
import { writeAuditLog } from "@/lib/admin/audit";

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
      !Number.isFinite(gameNumber) ||
      !isValidGameNumber(Number(gameNumber))
    ) {
      return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (!Number.isFinite(laneNumber)) {
      return NextResponse.json({ message: "INVALID_LANE" }, { status: 400 });
    }

    if (!isValidScore(Number(score))) {
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

    const updatedAt = new Date().toISOString();
    const scoreRef = eventInfo.ref
      .collection("scores")
      .doc(`${normalizedPlayerId}_${gameNumber}`);

    await Promise.all([
      scoreRef.set({
        playerId: normalizedPlayerId,
        gameNumber: Number(gameNumber),
        score: Math.max(0, Number(score)),
        laneNumber: normalizedLaneNumber,
        updatedAt,
      }),
      eventInfo.ref.set({
        rankRefreshPending: true,
      }, { merge: true }),
    ]);

    const linkedEventId = typeof eventData.linkedEventId === "string" && eventData.linkedEventId
      ? eventData.linkedEventId
      : null;

    const aggregateTasks: Promise<unknown>[] = [
      rebuildEventScoreboardAggregate(adminDb, tournamentId, eventInfo.divisionId, eventId),
      rebuildOverallAggregate(adminDb, tournamentId, eventInfo.divisionId),
      markOverallAggregateStale(adminDb, tournamentId),
    ];

    if (linkedEventId) {
      aggregateTasks.push(
        rebuildEventScoreboardAggregate(adminDb, tournamentId, eventInfo.divisionId, linkedEventId),
      );
    }

    await Promise.all(aggregateTasks);

    invalidateCache(`bundle-scores:${tournamentId}:${eventInfo.divisionId}:${eventId}`);
    invalidateCache(`bundle-full:${tournamentId}:${eventInfo.divisionId}:${eventId}`);
    if (linkedEventId) {
      invalidateCache(`bundle-scores:${tournamentId}:${eventInfo.divisionId}:${linkedEventId}`);
      invalidateCache(`bundle-full:${tournamentId}:${eventInfo.divisionId}:${linkedEventId}`);
    }
    invalidateCache(`overall:${tournamentId}`);

    void writeAuditLog(adminDb, {
      targetType: "SCORE",
      targetId: `${normalizedPlayerId}_${gameNumber}`,
      action: "SCORE_SAVE",
      actorUid: session.uid,
      tournamentId,
      note: `${playerData.name} G${gameNumber} = ${score}점 (레인 ${normalizedLaneNumber})`,
    });

    return NextResponse.json({
      message: "SCORE_SAVED",
      updatedAt,
      rankRefreshPending: true,
    });
  } catch (error) {
    console.error("[score] SCORE_SAVE_FAILED", error);
    return NextResponse.json(
      { message: "SCORE_SAVE_FAILED" },
      { status: 500 },
    );
  }
}
