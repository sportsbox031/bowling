import { NextRequest, NextResponse } from "next/server";
import { calculateRandomAssignments } from "@/lib/services/competitionService";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";

export async function POST(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const playerIds = Array.isArray(body.playerIds) ? body.playerIds : [];
    const range = body.range;
    const gameCount = Number(body.gameCount ?? 6);
    const tableShift = Number(body.tableShift ?? 0);
    const seed = body.seed !== undefined ? Number(body.seed) : undefined;

    const result = calculateRandomAssignments({
      tournamentId: body.tournamentId,
      eventId: body.eventId,
      playerIds,
      range: {
        start: Number(range?.start),
        end: Number(range?.end),
      },
      gameCount,
      tableShift,
      seed,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: "INVALID_REQUEST", error: String((error as Error).message) },
      { status: 400 },
    );
  }
}
