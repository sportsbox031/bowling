import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const getParticipantsRef = (tournamentId: string, divisionId: string, eventId: string) => {
  if (!adminDb) return null;
  return adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .doc(divisionId)
    .collection("events")
    .doc(eventId)
    .collection("participants");
};

export async function GET(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const ref = getParticipantsRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const snap = await ref.get();
  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}

export async function POST(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const ref = getParticipantsRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const body = await req.json();
  const playerIds: string[] = Array.isArray(body?.playerIds) ? body.playerIds.filter((id: unknown) => typeof id === "string" && id.trim()) : [];
  const squadId = typeof body?.squadId === "string" ? body.squadId.trim() : undefined;

  if (playerIds.length === 0) {
    return NextResponse.json({ message: "NO_PLAYER_IDS" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const batch = adminDb!.batch();
  for (const playerId of playerIds) {
    const data: Record<string, string> = { playerId, createdAt: now };
    if (squadId) data.squadId = squadId;
    batch.set(ref.doc(playerId), data, { merge: true });
  }
  await batch.commit();

  return NextResponse.json({ message: "PARTICIPANTS_ADDED", count: playerIds.length });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const ref = getParticipantsRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const body = await req.json();
  const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
  const squadId = typeof body?.squadId === "string" ? body.squadId.trim() : undefined;

  if (!playerId) {
    return NextResponse.json({ message: "NO_PLAYER_ID" }, { status: 400 });
  }

  const updateData: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (squadId !== undefined) updateData.squadId = squadId;

  await ref.doc(playerId).set(updateData, { merge: true });
  return NextResponse.json({ message: "PARTICIPANT_UPDATED", playerId });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const ref = getParticipantsRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const body = await req.json();
  const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";

  if (!playerId) {
    return NextResponse.json({ message: "NO_PLAYER_ID" }, { status: 400 });
  }

  await ref.doc(playerId).delete();
  return NextResponse.json({ message: "PARTICIPANT_REMOVED", playerId });
}
