import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, setCache } from "@/lib/api-cache";
import { readEventScoreboardAggregate, rebuildEventScoreboardAggregate } from "@/lib/aggregates/event-scoreboard";
import { readOverallAggregate, rebuildOverallAggregate } from "@/lib/aggregates/overall";
import { sortAssignmentsByPosition } from "@/lib/assignment-position";

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
    const assignments = sortAssignmentsByPosition(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) })) as any[]);
    const result = { assignments };
    setCache(cacheKey, result, 10000);
    return NextResponse.json(result);
  }

  if (only === "setup") {
    const cacheKey = `bundle-setup:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [eventMetaSnap, playersSnap, participantsSnap, squadsSnap, assignmentsSnap] = await Promise.all([
      eventRef.get(),
      db.collection("tournaments").doc(tournamentId)
        .collection("players").where("divisionId", "==", divisionId).get(),
      eventRef.collection("participants").get(),
      eventRef.collection("squads").orderBy("createdAt").get(),
      eventRef.collection("assignments").orderBy("gameNumber").get(),
    ]);

    const eventMeta = eventMetaSnap.data() ?? {};
    const result = {
      event: {
        id: eventId,
        title: String(eventMeta.title ?? ""),
        kind: String(eventMeta.kind ?? ""),
        gameCount: Number(eventMeta.gameCount ?? 1),
        scheduleDate: String(eventMeta.scheduleDate ?? ""),
        laneStart: Number(eventMeta.laneStart ?? 0),
        laneEnd: Number(eventMeta.laneEnd ?? 0),
        tableShift: Number(eventMeta.tableShift ?? 0),
        linkedEventId: typeof eventMeta.linkedEventId === "string" ? eventMeta.linkedEventId : null,
        halfType: typeof eventMeta.halfType === "string" ? eventMeta.halfType : null,
        rankRefreshPending: Boolean(eventMeta.rankRefreshPending),
        rankRefreshedAt: typeof eventMeta.rankRefreshedAt === "string" ? eventMeta.rankRefreshedAt : null,
      },
      players: playersSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as any))
        .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0)),
      participants: participantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      squads: squadsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      assignments: sortAssignmentsByPosition(assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) })) as any[]),
    };

    setCache(cacheKey, result, 15000);
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

  const [eventAggregate, overallAggregate, eventMetaSnap, playersSnap, participantsSnap, squadsSnap, assignmentsSnap, teamsSnap] =
    await Promise.all([
      readEventScoreboardAggregate(db, tournamentId, divisionId, eventId)
        .then((value) => value ?? rebuildEventScoreboardAggregate(db, tournamentId, divisionId, eventId)),
      readOverallAggregate(db, tournamentId, divisionId)
        .then((value) => value ?? rebuildOverallAggregate(db, tournamentId, divisionId)),
      eventRef.get(),
      db.collection("tournaments").doc(tournamentId)
        .collection("players").where("divisionId", "==", divisionId).get(),
      eventRef.collection("participants").get(),
      eventRef.collection("squads").orderBy("createdAt").get(),
      eventRef.collection("assignments").orderBy("gameNumber").get(),
      eventRef.collection("teams").orderBy("createdAt").get(),
    ]);

  const eventMeta = eventMetaSnap.data() ?? {};
  const players = playersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0));
  const participants = participantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const squads = squadsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const assignments = sortAssignmentsByPosition(assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, any>) })) as any[]);
  const teams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const result = {
    event: {
      ...eventAggregate.event,
      rankRefreshPending: Boolean(eventMeta.rankRefreshPending),
      rankRefreshedAt: typeof eventMeta.rankRefreshedAt === "string" ? eventMeta.rankRefreshedAt : null,
    },
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





