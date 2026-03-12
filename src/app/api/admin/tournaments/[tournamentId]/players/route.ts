import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import {
  buildPlayerDocument,
  getNextPlayerNumber,
  getPlayersRef,
  isValidPlayerInput,
  normalizePlayerInput,
} from "@/lib/admin/players";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const q = new URL(req.url).searchParams;
  const divisionId = q.get("divisionId");
  const group = q.get("group");
  const keyword = (q.get("q") ?? "").toLowerCase().trim();

  let query: FirebaseFirestore.Query = getPlayersRef(adminDb, ctx.params.tournamentId);
  if (divisionId) {
    query = query.where("divisionId", "==", divisionId);
  }
  if (group) {
    query = query.where("group", "==", group);
  }

  const snap = await query.orderBy("number").get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .filter((item: any) => {
      if (keyword && !(`${item.name}`.toLowerCase().includes(keyword) || `${item.affiliation}`.toLowerCase().includes(keyword))) {
        return false;
      }
      return true;
    });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const input = normalizePlayerInput(await req.json());
  if (!isValidPlayerInput(input)) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const playersRef = getPlayersRef(adminDb, ctx.params.tournamentId);
  const number = await getNextPlayerNumber(adminDb, ctx.params.tournamentId);
  const data = await buildPlayerDocument(adminDb, ctx.params.tournamentId, input, number);

  const playerRef = playersRef.doc();
  await playerRef.set(data);

  return NextResponse.json({ id: playerRef.id, ...data });
}
