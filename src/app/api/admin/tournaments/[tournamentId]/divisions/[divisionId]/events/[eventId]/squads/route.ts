import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const getSquadsRef = (tournamentId: string, divisionId: string, eventId: string) => {
  if (!adminDb) return null;
  return adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .doc(divisionId)
    .collection("events")
    .doc(eventId)
    .collection("squads");
};

export async function GET(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const ref = getSquadsRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const snap = await ref.orderBy("createdAt").get();
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

  const ref = getSquadsRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  if (!ref) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ message: "INVALID_NAME" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const docRef = ref.doc();
  await docRef.set({ name, createdAt: now });

  return NextResponse.json({ id: docRef.id, name, createdAt: now });
}
