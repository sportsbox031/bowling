import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache } from "@/lib/api-cache";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { readOverallAggregate, rebuildOverallAggregate } from "@/lib/aggregates/overall";

export async function GET(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const db = adminDb;
  const { tournamentId, divisionId, eventId } = ctx.params;
  const only = new URL(req.url).searchParams.get("only") ?? "";

  const eventRef = db
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").doc(eventId);

  if (only === "assignments") {
    const cacheKey = `bundle-assign:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const snap = await eventRef.collection("assignments").orderBy("gameNumber").get();
    const assignments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const result = { assignments };
    setCache(cacheKey, result, 10000);
    return NextResponse.json(result);
  }

  if (only === "scores") {
    const cacheKey = `bundle-scores:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [eventAggregate, overallAggregate] = await Promise.all([
      readEventScoreboardAggregate(db, tournamentId, divisionId, eventId)
        .then((value) => value ?? rebuildEventScoreboardAggregate(db, tournamentId, divisionId, eventId)),
      readOverallAggregate(db, tournamentId, divisionId)
        .then((value) => value ?? rebuildOverallAggregate(db, tournamentId, divisionId)),
    ]);

    const result = {
      eventRows: eventAggregate.eventRows,
      overallRows: overallAggregate.rows,
      eventTitleMap: overallAggregate.eventTitleMap,
      ...(eventAggregate.teamRows ? { teamRows: eventAggregate.teamRows } : {}),
      ...(eventAggregate.fivesCombinedRows ? { fivesCombinedRows: eventAggregate.fivesCombinedRows } : {}),
    };
    setCache(cacheKey, result, 10000);
    return NextResponse.json(result);
  }

  const cacheKey = `bundle-full:${tournamentId}:${divisionId}:${eventId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [eventAggregate, overallAggregate, playersSnap, participantsSnap, squadsSnap, assignmentsSnap, teamsSnap] =
    await Promise.all([
      readEventScoreboardAggregate(db, tournamentId, divisionId, eventId)
        .then((value) => value ?? rebuildEventScoreboardAggregate(db, tournamentId, divisionId, eventId)),
      readOverallAggregate(db, tournamentId, divisionId)
        .then((value) => value ?? rebuildOverallAggregate(db, tournamentId, divisionId)),
      db.collection("tournaments").doc(tournamentId)
        .collection("players").where("divisionId", "==", divisionId).get(),
      eventRef.collection("participants").get(),
      eventRef.collection("squads").orderBy("createdAt").get(),
      eventRef.collection("assignments").orderBy("gameNumber").get(),
      eventRef.collection("teams").orderBy("createdAt").get(),
    ]);

  const players = playersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0));
  const participants = participantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const squads = squadsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const assignments = assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const teams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const result = {
    event: eventAggregate.event,
    players,
    participants,
    squads,
    assignments,
    teams,
    eventRows: eventAggregate.eventRows,
    overallRows: overallAggregate.rows,
    eventTitleMap: overallAggregate.eventTitleMap,
    ...(eventAggregate.teamRows ? { teamRows: eventAggregate.teamRows } : {}),
    ...(eventAggregate.fivesCombinedRows ? { fivesCombinedRows: eventAggregate.fivesCombinedRows } : {}),
  };

  setCache(cacheKey, result, 15000);
  return NextResponse.json(result);
}



