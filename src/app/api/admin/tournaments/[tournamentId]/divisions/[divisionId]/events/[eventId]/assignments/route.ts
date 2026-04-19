import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { calculateRandomAssignments } from "@/lib/services/competitionService";
import { buildFivesAssignmentSegments } from "@/lib/services/competitionService";
import { getEventRefOrThrow } from "@/lib/firebase/eventPath";
import { getCached, setCache, invalidateCache } from "@/lib/api-cache";
import { rebuildEventAssignmentsAggregate } from "@/lib/aggregates/event-assignments";
import { sortAssignmentsByPosition, withAssignmentPositions } from "@/lib/assignment-position";
import { isValidFirestoreId } from "@/lib/validation";
import { isFivesEventConfig } from "@/lib/fives-config";
import type { DocumentReference, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { toDoc } from "@/lib/firebase/docUtils";

interface AssignmentItem {
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  squadId?: string;
  position?: number;
}

const MAX_PLAYERS_PER_LANE = 4;
const MAX_GAME_NUMBER = 20;
const MAX_TABLE_SHIFT = 20;

const writeAssignments = async (eventRef: DocumentReference, assignments: AssignmentItem[]) => {
  if (!eventRef || typeof eventRef.collection !== "function") {
    return;
  }

  const batch = eventRef.parent.firestore.batch();
  for (const item of assignments) {
    const docId = `${item.playerId}_${item.gameNumber}`;
    const data: Record<string, string | number> = {
      playerId: item.playerId,
      gameNumber: item.gameNumber,
      laneNumber: item.laneNumber,
      updatedAt: new Date().toISOString(),
    };
    if (Number.isFinite(item.position)) data.position = Number(item.position);
    if (item.squadId) data.squadId = item.squadId;
    batch.set(
      eventRef.collection("assignments").doc(docId),
      data,
      { merge: true },
    );
  }

  await batch.commit();
};

const clearAssignments = async (eventRef: DocumentReference, gameNumbers?: number[]) => {
  const snap = await eventRef.collection("assignments").get();
  const targets = gameNumbers
    ? snap.docs.filter((doc: QueryDocumentSnapshot) => gameNumbers.includes(Number(doc.data().gameNumber)))
    : snap.docs;

  if (targets.length === 0) {
    return;
  }

  const batch = eventRef.parent.firestore.batch();
  for (const doc of targets) {
    batch.delete(doc.ref);
  }

  await batch.commit();
};

const normalizeManualItems = (items: unknown[]): AssignmentItem[] =>
  items
    .map((raw) => {
      const parsed = raw as AssignmentItem;
      return {
        playerId: String(parsed?.playerId ?? "").trim(),
        gameNumber: Number(parsed?.gameNumber),
        laneNumber: Number(parsed?.laneNumber),
        position: Number(parsed?.position),
      };
    })
    .filter((item) => Boolean(item.playerId));

const replaceAssignmentsByGame = async (eventRef: DocumentReference, assignments: AssignmentItem[]) => {
  const gameNumbers = Array.from(new Set(assignments.map((item) => item.gameNumber)));
  await clearAssignments(eventRef, gameNumbers);
  await writeAssignments(eventRef, assignments);
};

const validateManualItems = (items: AssignmentItem[], eventData: {
  laneStart: number;
  laneEnd: number;
  gameCount: number;
  playerIds: Set<string>;
  maxPerLane?: number;
}): string | AssignmentItem[] => {
  if (eventData.gameCount < 1 || !Number.isFinite(eventData.gameCount) || eventData.gameCount > 20) {
    return "INVALID_EVENT_CONFIG";
  }

  if (!Number.isFinite(eventData.laneStart) || !Number.isFinite(eventData.laneEnd) || eventData.laneStart < 1) {
    return "INVALID_EVENT_CONFIG";
  }

  if (eventData.laneEnd < eventData.laneStart) {
    return "INVALID_EVENT_CONFIG";
  }

  const laneCounts = new Map<string, number>();
  const playerGamePairs = new Set<string>();
  const result: AssignmentItem[] = [];

  for (const item of items) {
    if (!Number.isFinite(item.gameNumber) || item.gameNumber < 1 || item.gameNumber > eventData.gameCount) {
      return "INVALID_GAME_NUMBER";
    }

    if (item.gameNumber > MAX_GAME_NUMBER) {
      return "INVALID_GAME_NUMBER";
    }

    if (!Number.isFinite(item.laneNumber) || item.laneNumber < eventData.laneStart || item.laneNumber > eventData.laneEnd) {
      return "INVALID_LANE_RANGE";
    }

    if (!eventData.playerIds.has(item.playerId)) {
      return "INVALID_PLAYER";
    }

    const key = `${item.playerId}:${item.gameNumber}`;
    if (playerGamePairs.has(key)) {
      return "DUPLICATE_PLAYER_IN_GAME";
    }
    playerGamePairs.add(key);

    const laneKey = `${item.gameNumber}:${item.laneNumber}`;
    const nextCount = (laneCounts.get(laneKey) ?? 0) + 1;
    if (nextCount > (eventData.maxPerLane ?? MAX_PLAYERS_PER_LANE)) {
      return "LANE_CAPACITY_EXCEEDED";
    }
    laneCounts.set(laneKey, nextCount);

    result.push({ ...item });
  }

  return result;
};

const getParticipantIds = async (tournamentId: string, divisionId: string, eventId: string, squadId?: string) => {
  if (!adminDb) {
    return null;
  }

  const participantsSnap = await adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .doc(divisionId)
    .collection("events")
    .doc(eventId)
    .collection("participants")
    .get();

  if (!squadId) {
    return new Set(participantsSnap.docs.map((doc) => doc.id));
  }

  return new Set(
    participantsSnap.docs
      .filter((doc) => doc.data().squadId === squadId)
      .map((doc) => doc.id),
  );
};

const clearAssignmentsBySquad = async (eventRef: DocumentReference, squadId: string) => {
  const snap = await eventRef.collection("assignments").get();
  const targets = snap.docs.filter((doc: QueryDocumentSnapshot) => doc.data().squadId === squadId);
  if (targets.length === 0) return;
  const batch = eventRef.parent.firestore.batch();
  for (const doc of targets) batch.delete(doc.ref);
  await batch.commit();
};

export async function GET(
  _req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const { tournamentId, divisionId, eventId } = ctx.params;
  const session = await verifyAdminSessionToken(_req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isValidFirestoreId(tournamentId) || !isValidFirestoreId(divisionId) || !isValidFirestoreId(eventId)) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const event = await getEventRefOrThrow(tournamentId, eventId, divisionId);
  if (!event) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const squadId = new URL(_req.url).searchParams.get("squadId") ?? undefined;
  const cacheKey = `assignments:${tournamentId}:${divisionId}:${eventId}:${squadId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const snap = await event.ref.collection("assignments").orderBy("gameNumber").get();
  const allItems = sortAssignmentsByPosition(snap.docs.map(toDoc<AssignmentItem>));
  const items = squadId ? allItems.filter((item) => item.squadId === squadId) : allItems;
  const result = { items };
  setCache(cacheKey, result, 15000);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string; eventId: string } }) {
  const { tournamentId, divisionId, eventId } = ctx.params;
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isValidFirestoreId(tournamentId) || !isValidFirestoreId(divisionId) || !isValidFirestoreId(eventId)) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const event = await getEventRefOrThrow(tournamentId, eventId, divisionId);
  if (!event) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json();
  const mode = body?.mode ?? "random";
  const squadId = typeof body?.squadId === "string" ? body.squadId.trim() : undefined;

  if (mode !== "random" && mode !== "manual") {
    return NextResponse.json({ message: "INVALID_MODE" }, { status: 400 });
  }

  const eventDoc = await event.ref.get();
  const eventData = eventDoc.data() ?? {};
  const laneStart = Number(eventData.laneStart ?? 1);
  const laneEnd = Number(eventData.laneEnd ?? laneStart);
  const gameCount = Number(eventData.gameCount ?? 0);
  const tableShift = Number(eventData.tableShift ?? 0);
  const eventPlayerIds = await getParticipantIds(tournamentId, divisionId, eventId, squadId);
  if (!eventPlayerIds) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  if (mode === "manual") {
    const items = withAssignmentPositions(normalizeManualItems(Array.isArray(body?.items) ? body.items : []));
    const replaceAll = body?.replaceAll === true;
    if (!items.length && !replaceAll) {
      return NextResponse.json({ message: "NO_ITEMS" }, { status: 400 });
    }

    const eventKind = (eventData.kind as string) ?? "";
    const maxPerLane = eventKind === "FIVES" ? 5 : MAX_PLAYERS_PER_LANE;
    const normalized = validateManualItems(items, {
      laneStart,
      laneEnd,
      gameCount,
      playerIds: eventPlayerIds,
      maxPerLane,
    });

    if (typeof normalized === "string") {
      return NextResponse.json({ message: normalized }, { status: 400 });
    }

    if (replaceAll) {
      if (squadId) {
        await clearAssignmentsBySquad(event.ref, squadId);
      } else {
        await clearAssignments(event.ref);
      }
      const itemsWithSquad = squadId ? normalized.map((item) => ({ ...item, squadId })) : normalized;
      await writeAssignments(event.ref, itemsWithSquad);
    } else {
      await replaceAssignmentsByGame(event.ref, normalized);
    }

    invalidateCache(`assignments:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`pub-assignments:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`bundle-assign:${tournamentId}`);
    invalidateCache(`bundle-full:${tournamentId}`);
    rebuildEventAssignmentsAggregate(adminDb, tournamentId, divisionId, eventId).catch(console.error);
    return NextResponse.json({ message: "ASSIGNMENTS_SAVED", mode: "manual" });
  }

  if (!Number.isFinite(laneStart) || !Number.isFinite(laneEnd) || laneStart < 1 || laneEnd < laneStart) {
    console.error("[assignments] INVALID_EVENT_LANE_RANGE", { laneStart, laneEnd, raw: eventData });
    return NextResponse.json({ message: "INVALID_EVENT_LANE_RANGE", detail: { laneStart, laneEnd } }, { status: 400 });
  }

  if (!Number.isFinite(gameCount) || gameCount < 1 || gameCount > MAX_GAME_NUMBER) {
    console.error("[assignments] INVALID_EVENT_GAME_COUNT", { gameCount, raw: eventData });
    return NextResponse.json({ message: "INVALID_EVENT_GAME_COUNT", detail: { gameCount } }, { status: 400 });
  }

  if (!Number.isFinite(tableShift) || Math.abs(tableShift) > MAX_TABLE_SHIFT) {
    console.error("[assignments] INVALID_EVENT_TABLE_SHIFT", { tableShift, raw: eventData });
    return NextResponse.json({ message: "INVALID_EVENT_TABLE_SHIFT", detail: { tableShift } }, { status: 400 });
  }

  const playerIds = Array.from(eventPlayerIds.values());
  if (playerIds.length === 0) {
    await clearAssignments(event.ref);
    invalidateCache(`assignments:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`pub-assignments:${tournamentId}:${divisionId}:${eventId}`);
    invalidateCache(`bundle-assign:${tournamentId}`);
    invalidateCache(`bundle-full:${tournamentId}`);
    rebuildEventAssignmentsAggregate(adminDb, tournamentId, divisionId, eventId).catch(console.error);
    return NextResponse.json({ message: "NO_PLAYERS", mode: "random", firstGame: [], gameBoard: {} });
  }

  const laneCount = laneEnd - laneStart + 1;
  const eventKind = (eventData.kind as string) ?? "";
  const maxPerLane = eventKind === "FIVES" ? 5 : MAX_PLAYERS_PER_LANE;
  if (playerIds.length > laneCount * maxPerLane) {
    console.error("[assignments] LANE_CAPACITY_EXCEEDED", { playerCount: playerIds.length, laneCount, maxCapacity: laneCount * maxPerLane });
    return NextResponse.json(
      { message: "LANE_CAPACITY_EXCEEDED", detail: { playerCount: playerIds.length, laneCount, maxCapacity: laneCount * maxPerLane } },
      { status: 400 },
    );
  }

  const result = calculateRandomAssignments({
    playerIds,
    range: { start: laneStart, end: laneEnd },
    gameCount,
    tableShift,
    tournamentId,
    eventId,
    segments: eventKind === "FIVES" && isFivesEventConfig(eventData.fivesConfig)
      ? buildFivesAssignmentSegments(gameCount, eventData.fivesConfig)
      : undefined,
  });

  const firstGame = result.firstGameAssignments.map((item) => ({
    playerId: item.playerId,
    gameNumber: 1,
    laneNumber: item.laneNumber,
  }));
  const all: AssignmentItem[] = [];

  if (squadId) {
    await clearAssignmentsBySquad(event.ref, squadId);
  } else {
    await clearAssignments(event.ref);
  }

  for (const gameNumber of Object.keys(result.gameBoard).map((item) => Number(item))) {
    const board = result.gameBoard[gameNumber];
    for (const slot of board) {
      all.push({
        playerId: slot.playerId,
        gameNumber,
        laneNumber: slot.laneNumber,
        squadId,
      });
    }
  }

  await writeAssignments(event.ref, withAssignmentPositions(all));
  invalidateCache(`assignments:${tournamentId}:${divisionId}:${eventId}`);
  invalidateCache(`pub-assignments:${tournamentId}:${divisionId}:${eventId}`);
  invalidateCache(`bundle-assign:${tournamentId}`);
  invalidateCache(`bundle-full:${tournamentId}`);
  rebuildEventAssignmentsAggregate(adminDb, tournamentId, divisionId, eventId).catch(console.error);
  return NextResponse.json({ mode: "random", firstGame, gameBoard: result.gameBoard });
}



