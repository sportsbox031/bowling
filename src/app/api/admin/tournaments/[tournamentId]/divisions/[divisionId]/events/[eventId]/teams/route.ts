import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import type { TeamType } from "@/lib/models";
import { hydrateMissingTeamMemberships, setTeamMemberships } from "@/lib/admin/team-membership";
import { deriveTeamIdentity } from "@/lib/team-identity";

type Ctx = { params: { tournamentId: string; divisionId: string; eventId: string } };

const getTeamsRef = (tournamentId: string, divisionId: string, eventId: string) => {
  if (!adminDb) return null;
  return adminDb.collection(firestorePaths.teams(tournamentId, divisionId, eventId));
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });

  const ref = getTeamsRef(ctx.params.tournamentId, ctx.params.divisionId, ctx.params.eventId);
  if (!ref) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const snap = await ref.orderBy("createdAt").get();
  const teams = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ teams });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });

  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;
  const { tournamentId, divisionId, eventId } = ctx.params;
  const ref = getTeamsRef(tournamentId, divisionId, eventId);
  if (!ref) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const memberIds: string[] = Array.isArray(body?.memberIds) ? body.memberIds : [];
  const rosterIds: string[] | undefined = Array.isArray(body?.rosterIds) ? body.rosterIds : undefined;
  const nameOverride: string | undefined = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined;

  if (memberIds.length < 1) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const memberships = await hydrateMissingTeamMemberships(db, tournamentId, divisionId, eventId, memberIds);
  const duplicates = memberIds.filter((id) => memberships.has(id));
  if (duplicates.length > 0) {
    return NextResponse.json({ message: "MEMBER_ALREADY_IN_TEAM", duplicates }, { status: 409 });
  }

  const playerDocs = await Promise.all(
    memberIds.map((pid) =>
      db.collection(firestorePaths.players(tournamentId)).doc(pid).get(),
    ),
  );
  const { teamType, normalTeamName } = deriveTeamIdentity(
    playerDocs.map((doc) => ({
      affiliation: (doc.data()?.affiliation as string | undefined) ?? "",
      group: (doc.data()?.group as string | undefined) ?? "",
    })),
  );
  let teamName: string;
  if (nameOverride) {
    teamName = nameOverride;
  } else if (teamType === "NORMAL") {
    teamName = normalTeamName ?? "";
  } else {
    const makeupCount = (
      await ref.where("teamType", "==", "MAKEUP").get()
    ).size;
    teamName = `혼성팀 ${makeupCount + 1}`;
  }

  const now = new Date().toISOString();
  const docRef = ref.doc();
  const teamData = {
    tournamentId,
    divisionId,
    eventId,
    name: teamName,
    teamType,
    memberIds,
    ...(rosterIds ? { rosterIds } : {}),
    createdAt: now,
    updatedAt: now,
  };
  const batch = db.batch();
  batch.set(docRef, teamData);
  setTeamMemberships(batch, db, tournamentId, divisionId, eventId, docRef.id, memberIds, now);
  await batch.commit();

  return NextResponse.json({ id: docRef.id, ...teamData }, { status: 201 });
}
