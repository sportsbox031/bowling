import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const eventKinds = ["SINGLE", "DOUBLES", "TRIPLES", "FOURS", "FIVES", "OVERALL"] as const;
type EventKind = (typeof eventKinds)[number];
const MAX_TABLE_SHIFT = 20;

const parseEvent = (payload: any) => ({
  title: typeof payload?.title === "string" ? payload.title.trim() : undefined,
  kind: typeof payload?.kind === "string" ? payload.kind.toUpperCase() : undefined,
  gameCount: Number(payload?.gameCount),
  scheduleDate: typeof payload?.scheduleDate === "string" ? payload.scheduleDate : undefined,
  laneStart: Number(payload?.laneStart),
  laneEnd: Number(payload?.laneEnd),
  tableShift: Number(payload?.tableShift),
});

const getRef = (
  db: NonNullable<typeof adminDb>,
  tournamentId: string,
  divisionId: string,
  eventId: string,
) =>
  db
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .doc(divisionId)
    .collection("events")
    .doc(eventId);

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
  const doc = await getRef(adminDb, ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId).get();
  if (!doc.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ id: doc.id, ...doc.data() });
}

export async function PUT(req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string; eventId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const ref = getRef(adminDb, ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  const target = await ref.get();
  if (!target.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const input = parseEvent(await req.json());
  const updateData: Record<string, string | number> = {};
  if (input.title) updateData.title = input.title;
  if (input.kind && eventKinds.includes(input.kind as EventKind)) updateData.kind = input.kind;
  if (Number.isFinite(input.gameCount) && input.gameCount >= 1 && input.gameCount <= 6) {
    updateData.gameCount = input.gameCount;
  }
  if (input.scheduleDate) updateData.scheduleDate = input.scheduleDate;
  if (Number.isFinite(input.laneStart) && input.laneStart >= 1) updateData.laneStart = input.laneStart;
  if (
    Number.isFinite(input.laneEnd) &&
    Number.isFinite(input.laneStart) &&
    input.laneEnd >= input.laneStart
  ) {
    updateData.laneEnd = input.laneEnd;
  }
  if (Number.isFinite(input.tableShift)) updateData.tableShift = input.tableShift;
  if (Number.isFinite(input.tableShift) && Math.abs(input.tableShift) > MAX_TABLE_SHIFT) {
    return NextResponse.json({ message: "INVALID_TABLE_SHIFT" }, { status: 400 });
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "NO_FIELDS" }, { status: 400 });
  }

  await ref.set({ ...updateData, updatedAt: new Date().toISOString() }, { merge: true });
  const updated = await ref.get();
  return NextResponse.json({ id: updated.id, ...(updated.data() as object) });
}

export async function DELETE(req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string; eventId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  await getRef(adminDb, ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId).delete();
  return NextResponse.json({ message: "DELETED", id: ctx.params.eventId });
}
