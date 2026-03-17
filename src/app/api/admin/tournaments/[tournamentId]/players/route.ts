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

  try {
    const q = new URL(req.url).searchParams;
    const divisionId = q.get("divisionId");
    const group = q.get("group");
    const keyword = (q.get("q") ?? "").toLowerCase().trim();

    // Keep filtering in-memory so admin pages don't depend on Firestore composite indexes
    // for `divisionId/group + number`.
    const snap = await getPlayersRef(adminDb, ctx.params.tournamentId).get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string }))
      .filter((item) => {
        if (divisionId && item.divisionId !== divisionId) {
          return false;
        }
        if (group && item.group !== group) {
          return false;
        }
        if (
          keyword &&
          !(`${item.name ?? ""}`.toLowerCase().includes(keyword) || `${item.affiliation ?? ""}`.toLowerCase().includes(keyword))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load tournament players", {
      tournamentId: ctx.params.tournamentId,
      error,
    });
    return NextResponse.json({ message: "PLAYER_LIST_FAILED" }, { status: 500 });
  }
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
