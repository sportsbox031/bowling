import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { invalidateCache } from "@/lib/api-cache";
import { rebuildPublicTournamentAggregate } from "@/lib/aggregates/public-tournament";

import { FieldPath } from "firebase-admin/firestore";

const BATCH_SIZE = 300;

const deleteCollection = async (collectionRef: any) => {
  while (true) {
    const snapshot = await collectionRef
      .orderBy(FieldPath.documentId())
      .limit(BATCH_SIZE)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = collectionRef.firestore.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    if (snapshot.size < BATCH_SIZE) {
      return;
    }
  }
};

const deletePlayersByDivision = async (divisionPlayersQuery: any) => {
  let cursor: any = null;

  while (true) {
    let query = divisionPlayersQuery.orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return;
    }

    const batch = divisionPlayersQuery.firestore.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    if (snapshot.size < BATCH_SIZE) {
      return;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
};

const deleteDivisionEvents = async (eventsRef: any) => {
  let cursor: any = null;

  while (true) {
    let query = eventsRef.orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return;
    }

    for (const eventDoc of snapshot.docs) {
      await deleteCollection(eventDoc.ref.collection("scores"));
      await deleteCollection(eventDoc.ref.collection("assignments"));
    }

    const batch = eventsRef.firestore.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    if (snapshot.size < BATCH_SIZE) {
      return;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
};

const normalizeDivision = (value: any) => ({
  code: typeof value?.code === "string" ? value.code.trim() : undefined,
  title: typeof value?.title === "string" ? value.title.trim() : undefined,
  ageLabel: typeof value?.ageLabel === "string" ? value.ageLabel.trim() : undefined,
  gender: typeof value?.gender === "string" ? value.gender.toUpperCase() : undefined,
});

const getDocRef = (database: NonNullable<typeof adminDb>, tournamentId: string, divisionId: string) =>
  database.collection("tournaments").doc(tournamentId).collection("divisions").doc(divisionId);

const refreshPublicTournamentCaches = async (tournamentId: string) => {
  if (!adminDb) return;
  try {
    await rebuildPublicTournamentAggregate(adminDb, tournamentId);
  } catch (error) {
    console.error("PUBLIC_TOURNAMENT_AGGREGATE_REBUILD_FAILED", error);
  }
  invalidateCache(`pub-tournament:${tournamentId}`);
};

export async function GET(_req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string } }) {
  const session = await verifyAdminSessionToken(_req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const doc = await getDocRef(adminDb, ctx.params.tournamentId, ctx.params.divisionId).get();
  if (!doc.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ id: doc.id, ...doc.data() });
}

export async function PUT(req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const ref = getDocRef(adminDb, ctx.params.tournamentId, ctx.params.divisionId);
  const target = await ref.get();
  if (!target.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const body = normalizeDivision(await req.json());
  const updateData: Record<string, string> = {};
  if (body.code) updateData.code = body.code;
  if (body.title) updateData.title = body.title;
  if (body.ageLabel) updateData.ageLabel = body.ageLabel;
  if (body.gender === "M" || body.gender === "F" || body.gender === "MIXED") {
    updateData.gender = body.gender;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "NO_FIELDS" }, { status: 400 });
  }

  await ref.set({ ...updateData, updatedAt: new Date().toISOString() }, { merge: true });
  await refreshPublicTournamentCaches(ctx.params.tournamentId);
  const updated = await ref.get();
  return NextResponse.json({ id: updated.id, ...(updated.data() as object) });
}

export async function DELETE(req: NextRequest, ctx: { params: { tournamentId: string; divisionId: string } }) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const divisionRef = getDocRef(adminDb, ctx.params.tournamentId, ctx.params.divisionId);
  const divisionDoc = await divisionRef.get();
  if (!divisionDoc.exists) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const tournamentPlayersRef = adminDb
    .collection("tournaments")
    .doc(ctx.params.tournamentId)
    .collection("players");
  await deletePlayersByDivision(
    tournamentPlayersRef.where("divisionId", "==", ctx.params.divisionId),
  );

  const eventsRef = divisionRef.collection("events");
  await deleteDivisionEvents(eventsRef);

  await divisionRef.delete();
  await refreshPublicTournamentCaches(ctx.params.tournamentId);
  return NextResponse.json({ message: "DELETED", id: ctx.params.divisionId });
}
