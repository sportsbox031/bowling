import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const normalizeDivision = (value: any) => ({
  title: typeof value?.title === "string" ? value.title.trim() : "",
  gender: typeof value?.gender === "string" ? value.gender.toUpperCase() : "",
});

export async function GET(_req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(_req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const tournamentId = ctx.params.tournamentId;
  const snap = await adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .orderBy("title")
    .get();

  return NextResponse.json({
    items: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  });
}

export async function POST(req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const tournamentRef = adminDb.collection("tournaments").doc(ctx.params.tournamentId);
  const tournament = await tournamentRef.get();
  if (!tournament.exists) {
    return NextResponse.json({ message: "TOURNAMENT_NOT_FOUND" }, { status: 404 });
  }

  const v = normalizeDivision(await req.json());
  if (!v.title || (v.gender !== "M" && v.gender !== "F" && v.gender !== "MIXED")) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const data = {
    tournamentId: ctx.params.tournamentId,
    title: v.title,
    gender: v.gender,
    createdAt: now,
    updatedAt: now,
  };

  const ref = tournamentRef.collection("divisions").doc();
  await ref.set(data);

  return NextResponse.json({ id: ref.id, ...data });
}
