import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const normalizePlayerInput = (body: any) => ({
  divisionId: typeof body?.divisionId === "string" ? body.divisionId.trim() : "",
  group: typeof body?.group === "string" ? body.group.trim() : "",
  region: typeof body?.region === "string" ? body.region.trim() : "",
  affiliation: typeof body?.affiliation === "string" ? body.affiliation.trim() : "",
  name: typeof body?.name === "string" ? body.name.trim() : "",
  hand: typeof body?.hand === "string" ? body.hand.toLowerCase() : "",
});

const getPlayersRef = (db: NonNullable<typeof adminDb>, tournamentId: string) =>
  db.collection("tournaments").doc(tournamentId).collection("players");

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

  const snap = await getPlayersRef(adminDb, ctx.params.tournamentId)
    .orderBy("number")
    .get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .filter((item: any) => {
      if (divisionId && item.divisionId !== divisionId) {
        return false;
      }
      if (group && item.group !== group) {
        return false;
      }
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
  if (
    !input.divisionId ||
    !input.group ||
    !input.region ||
    !input.affiliation ||
    !input.name ||
    (input.hand !== "left" && input.hand !== "right")
  ) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const playersRef = getPlayersRef(adminDb, ctx.params.tournamentId);
  const latest = await playersRef.orderBy("number", "desc").limit(1).get();
  const lastNumber = latest.docs[0]?.data().number ?? 0;
  const number = Number(lastNumber) + 1;

  const now = new Date().toISOString();
  const data = {
    tournamentId: ctx.params.tournamentId,
    divisionId: input.divisionId,
    group: input.group,
    region: input.region,
    affiliation: input.affiliation,
    number,
    name: input.name,
    hand: input.hand,
    createdAt: now,
    updatedAt: now,
  };

  const playerRef = playersRef.doc();
  await playerRef.set(data);

  return NextResponse.json({ id: playerRef.id, ...data });
}
