import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { getEventRefOrThrow } from "@/lib/firebase/eventPath";
import { invalidateCache } from "@/lib/api-cache";

const MAX_SCORE = 300;

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

    invalidateCache(`bundle-full:${tournamentId}:${eventInfo.divisionId}:${eventId}`);

    return NextResponse.json({
      message: "SCORE_SAVED",
      updatedAt,
      rankRefreshPending: true,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "SCORE_SAVE_FAILED", error: String((error as Error).message) },
      { status: 500 },
    );
  }
}
