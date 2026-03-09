import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import {
  buildPlayerDocument,
  getNextPlayerNumber,
  getPlayersRef,
  isValidPlayerInput,
  normalizePlayerInput,
} from "@/lib/admin/players";

export async function POST(req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const body = await req.json();
  const divisionId = typeof body?.divisionId === "string" ? body.divisionId.trim() : "";
  const rawPlayers: unknown[] = Array.isArray(body?.players) ? body.players : [];

  if (!divisionId || rawPlayers.length === 0) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const normalizedPlayers = rawPlayers.map((player: unknown) => normalizePlayerInput({ ...(player as object), divisionId }));
  const invalidIndex = normalizedPlayers.findIndex((player) => !isValidPlayerInput(player));
  if (invalidIndex >= 0) {
    return NextResponse.json({ message: "INVALID_PLAYER_ROW", row: invalidIndex + 1 }, { status: 400 });
  }

  const existingPlayers = await getPlayersRef(adminDb, ctx.params.tournamentId).get();
  const existingKeys = new Set(
    existingPlayers.docs.map((doc) => {
      const data = doc.data();
      return [data.divisionId, data.group, data.region, data.affiliation, data.name].join("::").toLowerCase();
    }),
  );

  let nextNumber = await getNextPlayerNumber(adminDb, ctx.params.tournamentId);
  const batch = adminDb.batch();
  const created: Array<{ id: string; name: string; number: number }> = [];

  for (const input of normalizedPlayers.filter(isValidPlayerInput)) {
    const dedupeKey = [input.divisionId, input.group, input.region, input.affiliation, input.name].join("::").toLowerCase();
    if (existingKeys.has(dedupeKey)) {
      continue;
    }

    const playerRef = getPlayersRef(adminDb, ctx.params.tournamentId).doc();
    const playerDoc = await buildPlayerDocument(adminDb, ctx.params.tournamentId, input, nextNumber);
    batch.set(playerRef, playerDoc);
    created.push({ id: playerRef.id, name: input.name, number: nextNumber });
    existingKeys.add(dedupeKey);
    nextNumber += 1;
  }

  if (created.length === 0) {
    return NextResponse.json({ message: "NO_NEW_PLAYERS" }, { status: 200 });
  }

  await batch.commit();

  return NextResponse.json({
    message: "PLAYERS_IMPORTED",
    count: created.length,
    items: created,
  });
}


