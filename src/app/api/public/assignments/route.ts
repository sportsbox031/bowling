import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { resolveEventRef } from "@/lib/firebase/eventPath";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get("tournamentId");
    const eventId = url.searchParams.get("eventId");
    const divisionId = url.searchParams.get("divisionId") ?? undefined;
    const squadId = url.searchParams.get("squadId") ?? undefined;

    if (!adminDb || !tournamentId || !eventId) {
      return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
    }

    const cacheKey = `pub-assignments:${tournamentId}:${divisionId}:${eventId}:${squadId ?? "all"}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      return jsonCached(cached, 30);
    }

    const event = await resolveEventRef(adminDb, tournamentId, eventId, divisionId);
    if (!event) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const eventDoc = (await event.ref.get()).data() ?? {};

    const [assignSnap, playersSnap, squadsSnap] = await Promise.all([
      event.ref.collection("assignments").orderBy("gameNumber").get(),
      adminDb.collection("tournaments").doc(tournamentId).collection("players").get(),
      event.ref.collection("squads").get(),
    ]);

    const playerMap = new Map<string, { name: string; number: number; affiliation: string; region: string }>();
    for (const doc of playersSnap.docs) {
      const data = doc.data();
      if (data.divisionId === event.divisionId) {
        playerMap.set(doc.id, {
          name: data.name,
          number: data.number,
          affiliation: data.affiliation,
          region: data.region,
        });
      }
    }

    const allAssignments = assignSnap.docs.map((doc) => {
      const data = doc.data();
      const player = playerMap.get(data.playerId);
      return {
        playerId: data.playerId,
        gameNumber: data.gameNumber,
        laneNumber: data.laneNumber,
        squadId: data.squadId ?? null,
        playerName: player?.name ?? "",
        playerNumber: player?.number ?? 0,
        affiliation: player?.affiliation ?? "",
        region: player?.region ?? "",
      };
    });

    const assignments = squadId
      ? allAssignments.filter((a) => a.squadId === squadId)
      : allAssignments;

    const squads = squadsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name ?? doc.id,
    }));

    const result = {
      assignments,
      squads,
      event: {
        id: eventId,
        title: eventDoc.title,
        kind: eventDoc.kind,
        gameCount: eventDoc.gameCount,
        laneStart: eventDoc.laneStart,
        laneEnd: eventDoc.laneEnd,
        tableShift: eventDoc.tableShift,
      },
    };

    setCache(cacheKey, result, 60000);
    return jsonCached(result, 30);
  } catch (error) {
    return NextResponse.json(
      { message: "ASSIGNMENTS_FETCH_FAILED", error: String((error as Error).message) },
      { status: 500 },
    );
  }
}
