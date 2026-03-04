import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { calculateRandomAssignments } from "@/lib/services/competitionService";
import { getEventRefOrThrow } from "@/lib/firebase/eventPath";

interface AssignmentItem {
  playerId: string;
  gameNumber: number;
  laneNumber: number;
}

const MAX_PLAYERS_PER_LANE = 4;
const MAX_GAME_NUMBER = 20;
const MAX_TABLE_SHIFT = 20;

const writeAssignments = async (eventRef: any, assignments: AssignmentItem[]) => {
  if (!eventRef || typeof eventRef.collection !== "function") {
    return;
  }

  const batch = eventRef.parent.firestore.batch();
  for (const item of assignments) {
    const docId = `${item.playerId}_${item.gameNumber}`;
    batch.set(
      eventRef.collection("assignments").doc(docId),
      {
        playerId: item.playerId,
        gameNumber: item.gameNumber,
        laneNumber: item.laneNumber,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  await batch.commit();
};

const clearAssignments = async (eventRef: any, gameNumbers?: number[]) => {
  const snap = await eventRef.collection("assignments").get();
  const targets = gameNumbers
    ? snap.docs.filter((doc: any) => gameNumbers.includes(Number(doc.data().gameNumber)))
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
      };
    })
    .filter((item) => Boolean(item.playerId));

const replaceAssignmentsByGame = async (eventRef: any, assignments: AssignmentItem[]) => {
  const gameNumbers = Array.from(new Set(assignments.map((item) => item.gameNumber)));
  await clearAssignments(eventRef, gameNumbers);
  await writeAssignments(eventRef, assignments);
};

const validateManualItems = (items: AssignmentItem[], eventData: {
  laneStart: number;
  laneEnd: number;
  gameCount: number;
  playerIds: Set<string>;
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
    if (nextCount > MAX_PLAYERS_PER_LANE) {
      return "LANE_CAPACITY_EXCEEDED";
    }
    laneCounts.set(laneKey, nextCount);

    result.push({ ...item });
  }

  return result;
};

const normalizePlayersInDivision = async (tournamentId: string, divisionId: string) => {
  if (!adminDb) {
    return null;
  }

  const playersSnap = await adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("players")
    .where("divisionId", "==", divisionId)
    .get();

  return new Set(playersSnap.docs.map((doc) => doc.id));
};

export async function GET(
  _req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(_req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const event = await getEventRefOrThrow(ctx.params.tournamentId, ctx.params.eventId, ctx.params.divisionId);
  if (!event) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const snap = await event.ref.collection("assignments").orderBy("gameNumber").orderBy("laneNumber").get();
  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string; eventId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const event = await getEventRefOrThrow(ctx.params.tournamentId, ctx.params.eventId, ctx.params.divisionId);
  if (!event) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json();
  const mode = body?.mode ?? "random";

  if (mode !== "random" && mode !== "manual") {
    return NextResponse.json({ message: "INVALID_MODE" }, { status: 400 });
  }

  const eventDoc = await event.ref.get();
  const eventData = eventDoc.data() ?? {};
  const laneStart = Number(eventData.laneStart ?? 1);
  const laneEnd = Number(eventData.laneEnd ?? laneStart);
  const gameCount = Number(eventData.gameCount ?? 0);
  const tableShift = Number(eventData.tableShift ?? 0);
  const eventPlayerIds = await normalizePlayersInDivision(ctx.params.tournamentId, ctx.params.divisionId);
  if (!eventPlayerIds) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  if (mode === "manual") {
    const items = normalizeManualItems(Array.isArray(body?.items) ? body.items : []);
    const replaceAll = body?.replaceAll === true;
    if (!items.length && !replaceAll) {
      return NextResponse.json({ message: "NO_ITEMS" }, { status: 400 });
    }

    const normalized = validateManualItems(items, {
      laneStart,
      laneEnd,
      gameCount,
      playerIds: eventPlayerIds,
    });

    if (typeof normalized === "string") {
      return NextResponse.json({ message: normalized }, { status: 400 });
    }

    if (replaceAll) {
      await clearAssignments(event.ref);
      await writeAssignments(event.ref, normalized);
    } else {
      await replaceAssignmentsByGame(event.ref, normalized);
    }

    return NextResponse.json({ message: "ASSIGNMENTS_SAVED", mode: "manual" });
  }

  if (!Number.isFinite(laneStart) || !Number.isFinite(laneEnd) || laneStart < 1 || laneEnd < laneStart) {
    return NextResponse.json({ message: "INVALID_EVENT_LANE_RANGE" }, { status: 400 });
  }

  if (!Number.isFinite(gameCount) || gameCount < 1 || gameCount > MAX_GAME_NUMBER) {
    return NextResponse.json({ message: "INVALID_EVENT_GAME_COUNT" }, { status: 400 });
  }

  if (!Number.isFinite(tableShift) || Math.abs(tableShift) > MAX_TABLE_SHIFT) {
    return NextResponse.json({ message: "INVALID_EVENT_TABLE_SHIFT" }, { status: 400 });
  }

  const playerIds = Array.from(eventPlayerIds.values());
  if (playerIds.length === 0) {
    await clearAssignments(event.ref);
    return NextResponse.json({ message: "NO_PLAYERS", mode: "random", firstGame: [], gameBoard: {} });
  }

  const laneCount = laneEnd - laneStart + 1;
  if (playerIds.length > laneCount * MAX_PLAYERS_PER_LANE) {
    return NextResponse.json(
      { message: "LANE_CAPACITY_EXCEEDED" },
      { status: 400 },
    );
  }

  const result = calculateRandomAssignments({
    playerIds,
    range: { start: laneStart, end: laneEnd },
    gameCount,
    tableShift,
    tournamentId: ctx.params.tournamentId,
    eventId: ctx.params.eventId,
  });

  const firstGame = result.firstGameAssignments.map((item) => ({
    playerId: item.playerId,
    gameNumber: 1,
    laneNumber: item.laneNumber,
  }));
  const all: AssignmentItem[] = [];

  await clearAssignments(event.ref);

  for (const gameNumber of Object.keys(result.gameBoard).map((item) => Number(item))) {
    const board = result.gameBoard[gameNumber];
    for (const slot of board) {
      all.push({
        playerId: slot.playerId,
        gameNumber,
        laneNumber: slot.laneNumber,
      });
    }
  }

  await writeAssignments(event.ref, all);
  return NextResponse.json({ mode: "random", firstGame, gameBoard: result.gameBoard });
}
