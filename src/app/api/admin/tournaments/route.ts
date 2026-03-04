import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const normalizeStatus = (value?: string) => {
  if (value === "ONGOING" || value === "FINISHED") {
    return value;
  }
  return "UPCOMING";
};

export async function GET(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const tournamentsSnap = await adminDb
    .collection("tournaments")
    .orderBy("startsAt", "desc")
    .get();

  const items = tournamentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const body = await req.json();
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const host = typeof body?.host === "string" ? body.host.trim() : "";
  const region = typeof body?.region === "string" ? body.region.trim() : "";
  const seasonYear = Number(body?.seasonYear) || new Date().getFullYear();
  const laneStart = Number(body?.laneStart);
  const laneEnd = Number(body?.laneEnd);

  const startsAt = typeof body?.startsAt === "string" ? body.startsAt : "";
  const endsAt = typeof body?.endsAt === "string" ? body.endsAt : "";

  if (!title || !host || !region || Number.isNaN(laneStart) || Number.isNaN(laneEnd) || !startsAt || !endsAt) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  if (laneStart < 1 || laneEnd < laneStart) {
    return NextResponse.json({ message: "INVALID_LANE_RANGE" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const data = {
    title,
    host,
    seasonYear,
    region,
    laneStart,
    laneEnd,
    startsAt,
    endsAt,
    status: normalizeStatus(body?.status),
    createdAt: now,
    updatedAt: now,
  };

  const docRef = adminDb.collection("tournaments").doc();
  await docRef.set(data);

  return NextResponse.json({ id: docRef.id, ...data });
}
