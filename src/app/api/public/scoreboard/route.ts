import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard } from "@/lib/scoring";
import { resolveEventRef } from "@/lib/firebase/eventPath";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get("tournamentId");
    const eventId = url.searchParams.get("eventId");
    const divisionId = url.searchParams.get("divisionId") ?? undefined;

    if (!adminDb || !tournamentId || !eventId) {
      return NextResponse.json(
        { message: "INVALID_QUERY" },
        { status: 400 },
      );
    }

    const event = await resolveEventRef(adminDb, tournamentId, eventId, divisionId);
    if (!event) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }
    const eventDoc = (await event.ref.get()).data() ?? {};

    const scoreSnap = await adminDb
      .collection("tournaments")
      .doc(tournamentId)
      .collection("divisions")
      .doc(event.divisionId)
      .collection("events")
      .doc(eventId)
      .collection("scores")
      .get();
    const playersSnap = await adminDb
      .collection("tournaments")
      .doc(tournamentId)
      .collection("players")
      .get();

    const scores = scoreSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        tournamentId,
        eventId,
        playerId: data.playerId,
        gameNumber: data.gameNumber,
        laneNumber: data.laneNumber ?? 0,
        score: data.score,
        createdAt: data.updatedAt ?? new Date().toISOString(),
      };
    });

    const players = playersSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          tournamentId,
          divisionId: data.divisionId,
          group: data.group,
          region: data.region,
          affiliation: data.affiliation,
          number: data.number,
          name: data.name,
          hand: data.hand,
          eventKinds: Array.isArray(data.eventKinds) ? data.eventKinds : [],
          createdAt: data.createdAt ?? new Date().toISOString(),
        };
      })
      .filter((player) => player.divisionId === event.divisionId);

    const leaderboard = buildEventLeaderboard({ players, scores });

    return NextResponse.json({
      ...leaderboard,
      event: {
        id: eventId,
        title: eventDoc.title,
        kind: eventDoc.kind,
        gameCount: eventDoc.gameCount,
        scheduleDate: eventDoc.scheduleDate,
        laneStart: eventDoc.laneStart,
        laneEnd: eventDoc.laneEnd,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: "LEADERBOARD_FAILED", error: String((error as Error).message) },
      { status: 500 },
    );
  }
}
