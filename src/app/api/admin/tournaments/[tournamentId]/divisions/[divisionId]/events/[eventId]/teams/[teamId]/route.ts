import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import type { TeamType } from "@/lib/models";

type Ctx = { params: { tournamentId: string; divisionId: string; eventId: string; teamId: string } };

const getTeamRef = (
  tournamentId: string,
  divisionId: string,
  eventId: string,
  teamId: string,
) => {
  if (!adminDb) return null;
  return adminDb.doc(firestorePaths.team(tournamentId, divisionId, eventId, teamId));
};

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });

  const { tournamentId, divisionId, eventId, teamId } = ctx.params;
  const teamRef = getTeamRef(tournamentId, divisionId, eventId, teamId);
  if (!teamRef) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) return NextResponse.json({ message: "TEAM_NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (Array.isArray(body?.memberIds) && body.memberIds.length >= 1) {
    const newMemberIds: string[] = body.memberIds;

    const teamsRef = adminDb.collection(firestorePaths.teams(tournamentId, divisionId, eventId));
    const allTeamsSnap = await teamsRef.get();
    const otherTeamMemberIds = new Set<string>();
    for (const doc of allTeamsSnap.docs) {
      if (doc.id === teamId) continue;
      const mids: string[] = Array.isArray(doc.data().memberIds) ? doc.data().memberIds : [];
      mids.forEach((id) => otherTeamMemberIds.add(id));
    }
    const duplicates = newMemberIds.filter((id) => otherTeamMemberIds.has(id));
    if (duplicates.length > 0) {
      const makeupTeamDocs = allTeamsSnap.docs.filter(
        (d) => d.id !== teamId && d.data().teamType === "MAKEUP",
      );
      const makeupMemberIds = new Set<string>();
      for (const doc of makeupTeamDocs) {
        const mids: string[] = Array.isArray(doc.data().memberIds) ? doc.data().memberIds : [];
        mids.forEach((id) => makeupMemberIds.add(id));
      }

      const nonMakeupDuplicates = duplicates.filter((id) => !makeupMemberIds.has(id));
      if (nonMakeupDuplicates.length > 0) {
        return NextResponse.json({ message: "MEMBER_ALREADY_IN_TEAM", duplicates: nonMakeupDuplicates }, { status: 409 });
      }

      for (const doc of makeupTeamDocs) {
        const data = doc.data();
        const mids: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
        const rids: string[] = Array.isArray(data.rosterIds) ? data.rosterIds : [];
        const removedIds = duplicates.filter((id) => mids.includes(id));
        if (removedIds.length === 0) continue;

        const newMids = mids.filter((id) => !removedIds.includes(id));
        const newRids = rids.filter((id) => !removedIds.includes(id));

        if (newMids.length === 0) {
          await doc.ref.delete();
        } else {
          const makeupUpdates: Record<string, unknown> = {
            memberIds: newMids,
            updatedAt: new Date().toISOString(),
          };
          if (rids.length > 0) makeupUpdates.rosterIds = newRids;
          await doc.ref.update(makeupUpdates);
        }
      }
    }

    const playerDocs = await Promise.all(
      newMemberIds.map((pid) =>
        adminDb!.collection(firestorePaths.players(tournamentId)).doc(pid).get(),
      ),
    );
    const affiliations = playerDocs.map((d) => (d.data()?.affiliation as string | undefined) ?? "");
    const uniqueAffiliations = new Set(affiliations.filter(Boolean));
    const teamType: TeamType = uniqueAffiliations.size === 1 ? "NORMAL" : "MAKEUP";

    updates.memberIds = newMemberIds;
    updates.teamType = teamType;

    if (typeof body?.name !== "string") {
      if (teamType === "NORMAL") {
        updates.name = [...uniqueAffiliations][0];
      }
    }
  }

  if (Array.isArray(body?.rosterIds)) {
    updates.rosterIds = body.rosterIds;
  }

  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }

  await teamRef.update(updates);
  return NextResponse.json({ id: teamId, ...teamDoc.data(), ...updates });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });

  const { tournamentId, divisionId, eventId, teamId } = ctx.params;
  const teamRef = getTeamRef(tournamentId, divisionId, eventId, teamId);
  if (!teamRef) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) return NextResponse.json({ message: "TEAM_NOT_FOUND" }, { status: 404 });

  await teamRef.delete();
  return NextResponse.json({ deleted: teamId });
}
