import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { invalidateCache } from "@/lib/api-cache";
import { rebuildPublicTournamentAggregate, deletePublicTournamentAggregate, rebuildPublicTournamentListAggregate } from "@/lib/aggregates/public-tournament";

const getTournamentRef = (database: NonNullable<typeof adminDb>, id: string) =>
  database.collection("tournaments").doc(id);

const ensureTournamentId = (id: string | undefined) => {
  if (!id || !id.trim()) {
    return null;
  }
  return id.trim();
};

const refreshPublicTournamentCaches = async (tournamentId: string, includeList = false) => {
  if (!adminDb) return;
  try {
    if (includeList) {
      await Promise.all([
        rebuildPublicTournamentAggregate(adminDb, tournamentId),
        rebuildPublicTournamentListAggregate(adminDb),
      ]);
    } else {
      await rebuildPublicTournamentAggregate(adminDb, tournamentId);
    }
  } catch (error) {
    console.error("PUBLIC_TOURNAMENT_AGGREGATE_REBUILD_FAILED", error);
  }
  invalidateCache(`pub-tournament:${tournamentId}`);
  if (includeList) {
    invalidateCache("pub-tournaments:");
  }
};

export async function GET(_req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(_req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }
  const id = ensureTournamentId(ctx.params.tournamentId);
  if (!id) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  const docSnap = await getTournamentRef(adminDb, id).get();
  if (!docSnap.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
}

export async function PUT(req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const id = ensureTournamentId(ctx.params.tournamentId);
  if (!id) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  const tournament = await getTournamentRef(adminDb, id).get();
  if (!tournament.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json();
  const updateData: Record<string, string | number> = {};

  if (typeof body?.title === "string" && body.title.trim()) updateData.title = body.title.trim();
  if (typeof body?.host === "string" && body.host.trim()) updateData.host = body.host.trim();
  if (typeof body?.region === "string" && body.region.trim()) updateData.region = body.region.trim();
  if (Number.isFinite(Number(body?.seasonYear))) updateData.seasonYear = Number(body.seasonYear);
  if (Number.isFinite(Number(body?.laneStart))) updateData.laneStart = Number(body.laneStart);
  if (Number.isFinite(Number(body?.laneEnd))) updateData.laneEnd = Number(body.laneEnd);
  if (typeof body?.startsAt === "string" && body.startsAt) updateData.startsAt = body.startsAt;
  if (typeof body?.endsAt === "string" && body.endsAt) updateData.endsAt = body.endsAt;
  if (body?.status === "UPCOMING" || body?.status === "ONGOING" || body?.status === "FINISHED") {
    updateData.status = body.status;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "NO_FIELDS" }, { status: 400 });
  }

  await getTournamentRef(adminDb, id).set(
    {
      ...updateData,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await refreshPublicTournamentCaches(id, true);
  const updated = await getTournamentRef(adminDb, id).get();
  return NextResponse.json({ id: updated.id, ...(updated.data() as object) });
}

export async function DELETE(req: NextRequest, ctx: { params: { tournamentId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const id = ensureTournamentId(ctx.params.tournamentId);
  if (!id) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  await getTournamentRef(adminDb, id).delete();
  try {
    await Promise.all([
      deletePublicTournamentAggregate(adminDb, id),
      rebuildPublicTournamentListAggregate(adminDb),
    ]);
  } catch (error) {
    console.error("PUBLIC_TOURNAMENT_AGGREGATE_DELETE_FAILED", error);
  }
  invalidateCache(`pub-tournament:${id}`);
  invalidateCache("pub-tournaments:");
  return NextResponse.json({ message: "DELETED", id });
}
