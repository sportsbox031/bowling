import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";

type DivisionDoc = {
  id: string;
  title: string;
  code: string;
  ageLabel?: string;
  gender?: string;
};

type EventDoc = {
  id: string;
  title: string;
  kind: string;
  gameCount: number;
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
};

export async function GET(_req: NextRequest, ctx: { params: { tournamentId: string } }) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const tournamentId = ctx.params.tournamentId;
  if (!tournamentId?.trim()) {
    return NextResponse.json({ message: "INVALID_TOURNAMENT_ID" }, { status: 400 });
  }

  const cacheKey = `pub-tournament:${tournamentId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    return jsonCached(cached, 60);
  }

  const tournamentDoc = await adminDb.collection("tournaments").doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    return NextResponse.json({ message: "TOURNAMENT_NOT_FOUND" }, { status: 404 });
  }

  const divisionsSnap = await adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .orderBy("title")
    .get();

  const divisionDocs: DivisionDoc[] = divisionsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  })) as DivisionDoc[];

  const eventsByDivision = await Promise.all(
    divisionDocs.map(async (division) => {
      const eventsSnap = await adminDb!
        .collection("tournaments")
        .doc(tournamentId)
        .collection("divisions")
        .doc(division.id)
        .collection("events")
        .orderBy("scheduleDate")
        .get();

      const events = eventsSnap.docs.map((doc) => ({
        ...(doc.data() as EventDoc),
        id: doc.id,
      }));

      return { divisionId: division.id, events };
    }),
  );

  const result = {
    tournament: { id: tournamentDoc.id, ...(tournamentDoc.data() as Record<string, unknown>) },
    divisions: divisionDocs,
    eventsByDivision,
  };
  setCache(cacheKey, result, 60000);
  return jsonCached(result, 60);
}

