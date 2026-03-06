import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const normalizePlayerInput = (body: any) => ({
  divisionId: typeof body?.divisionId === "string" ? body.divisionId.trim() : undefined,
  group: typeof body?.group === "string" ? body.group.trim() : undefined,
  region: typeof body?.region === "string" ? body.region.trim() : undefined,
  affiliation: typeof body?.affiliation === "string" ? body.affiliation.trim() : undefined,
  name: typeof body?.name === "string" ? body.name.trim() : undefined,
  hand: typeof body?.hand === "string" ? body.hand.toLowerCase() : undefined,
});

const getPlayerRef = (db: NonNullable<typeof adminDb>, tournamentId: string, playerId: string) =>
  db.collection("tournaments").doc(tournamentId).collection("players").doc(playerId);

export async function GET(
  _req: NextRequest,
  ctx: { params: { tournamentId: string; playerId: string } },
) {
  const session = await verifyAdminSessionToken(_req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const doc = await getPlayerRef(adminDb, ctx.params.tournamentId, ctx.params.playerId).get();
  if (!doc.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ id: doc.id, ...doc.data() });
}

export async function PUT(req: NextRequest, ctx: { params: { tournamentId: string; playerId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const ref = getPlayerRef(adminDb, ctx.params.tournamentId, ctx.params.playerId);
  const current = await ref.get();
  if (!current.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const input = normalizePlayerInput(await req.json());
  const updateData: Record<string, string | number> = {};
  if (input.divisionId) updateData.divisionId = input.divisionId;
  if (input.group) updateData.group = input.group;
  if (input.region) updateData.region = input.region;
  if (input.affiliation) updateData.affiliation = input.affiliation;
  if (input.name) updateData.name = input.name;
  if (input.hand === "left" || input.hand === "right") updateData.hand = input.hand;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "NO_FIELDS" }, { status: 400 });
  }

  await ref.set({ ...updateData, updatedAt: new Date().toISOString() }, { merge: true });
  const updated = await ref.get();
  return NextResponse.json({ id: updated.id, ...updated.data() });
}

export async function DELETE(req: NextRequest, ctx: { params: { tournamentId: string; playerId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  await getPlayerRef(adminDb, ctx.params.tournamentId, ctx.params.playerId).delete();
  return NextResponse.json({ message: "DELETED", id: ctx.params.playerId });
}
