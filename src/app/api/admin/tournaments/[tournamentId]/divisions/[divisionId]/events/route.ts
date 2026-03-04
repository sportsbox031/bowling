import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const eventKinds = ["SINGLE", "DOUBLES", "TRIPLES", "FOURS", "FIVES", "OVERALL"] as const;
type EventKind = (typeof eventKinds)[number];
const MAX_TABLE_SHIFT = 20;

const parseEvent = (payload: any) => ({
  title: typeof payload?.title === "string" ? payload.title.trim() : "",
  kind: typeof payload?.kind === "string" ? payload.kind.toUpperCase() : "",
  gameCount: Number(payload?.gameCount),
  scheduleDate: typeof payload?.scheduleDate === "string" ? payload.scheduleDate : "",
  laneStart: Number(payload?.laneStart),
  laneEnd: Number(payload?.laneEnd),
  tableShift: Number(payload?.tableShift),
});

const toCollection = (database: NonNullable<typeof adminDb>, tournamentId: string, divisionId: string) =>
  database.collection("tournaments").doc(tournamentId).collection("divisions").doc(divisionId).collection("events");

export async function GET(
  _req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string } },
) {
  const session = await verifyAdminSessionToken(_req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const snap = await toCollection(adminDb, ctx.params.tournamentId, ctx.params.divisionId)
    .orderBy("scheduleDate")
    .get();

  return NextResponse.json({
    items: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  });
}

export async function POST(req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const eventInput = parseEvent(await req.json());
  if (
    !eventInput.title ||
    !eventKinds.includes(eventInput.kind as EventKind) ||
    !Number.isInteger(eventInput.gameCount) ||
    eventInput.gameCount < 1 ||
    eventInput.gameCount > 6 ||
    Number.isNaN(eventInput.laneStart) ||
    Number.isNaN(eventInput.laneEnd) ||
    eventInput.laneStart < 1 ||
    eventInput.laneEnd < eventInput.laneStart ||
    !eventInput.scheduleDate ||
  Number.isNaN(eventInput.tableShift)
  ) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }
  if (Math.abs(eventInput.tableShift) > MAX_TABLE_SHIFT) {
    return NextResponse.json({ message: "INVALID_TABLE_SHIFT" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const data = {
    tournamentId: ctx.params.tournamentId,
    divisionId: ctx.params.divisionId,
    title: eventInput.title,
    kind: eventInput.kind,
    gameCount: eventInput.gameCount,
    scheduleDate: eventInput.scheduleDate,
    laneStart: eventInput.laneStart,
    laneEnd: eventInput.laneEnd,
    tableShift: eventInput.tableShift,
    createdAt: now,
    updatedAt: now,
  };

  const ref = toCollection(adminDb, ctx.params.tournamentId, ctx.params.divisionId).doc();
  await ref.set(data);

  return NextResponse.json({ id: ref.id, ...data });
}
