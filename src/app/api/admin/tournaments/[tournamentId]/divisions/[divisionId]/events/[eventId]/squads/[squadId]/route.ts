import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const getSquadRef = (tournamentId: string, divisionId: string, eventId: string, squadId: string) => {
  if (!adminDb) return null;
  return adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .doc(divisionId)
    .collection("events")
    .doc(eventId)
    .collection("squads")
    .doc(squadId);
};

export async function PUT(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string; squadId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const ref = getSquadRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId, ctx.params.squadId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ message: "INVALID_NAME" }, { status: 400 });
  }

  await ref.set({ name, updatedAt: new Date().toISOString() }, { merge: true });
  return NextResponse.json({ id: ctx.params.squadId, name });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string; squadId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const ref = getSquadRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId, ctx.params.squadId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  await ref.delete();
  return NextResponse.json({ message: "DELETED", id: ctx.params.squadId });
}
