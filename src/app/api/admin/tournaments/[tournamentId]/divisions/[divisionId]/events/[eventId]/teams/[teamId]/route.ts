import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import type { TeamType } from "@/lib/models";
import { deleteTeamMemberships, hydrateMissingTeamMemberships, setTeamMemberships } from "@/lib/admin/team-membership";

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
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;
  const teamRef = getTeamRef(tournamentId, divisionId, eventId, teamId);
  if (!teamRef) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) return NextResponse.json({ message: "TEAM_NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const now = updates.updatedAt as string;
  const currentData = teamDoc.data() ?? {};
  const currentMemberIds: string[] = Array.isArray(currentData.memberIds) ? currentData.memberIds : [];

  if (Array.isArray(body?.memberIds) && body.memberIds.length >= 1) {
    const newMemberIds: string[] = body.memberIds;
    const memberships = await hydrateMissingTeamMemberships(db, tournamentId, divisionId, eventId, newMemberIds);
    const duplicateTeamIds = new Set<string>();
    const duplicates = newMemberIds.filter((id) => {
      const membership = memberships.get(id);
      if (!membership || membership.teamId === teamId) return false;
      duplicateTeamIds.add(membership.teamId);
      return true;
    });
    if (duplicates.length > 0) {
      const duplicateTeamDocs = await Promise.all(
        [...duplicateTeamIds].map((duplicateTeamId) =>
          db.doc(firestorePaths.team(tournamentId, divisionId, eventId, duplicateTeamId)).get(),
        ),
      );
      const makeupTeamDocs = duplicateTeamDocs.filter((doc) => doc.exists && doc.data()?.teamType === "MAKEUP");
      const makeupMemberIds = new Set<string>();
      makeupTeamDocs.forEach((doc) => {
        const mids: string[] = Array.isArray(doc.data()?.memberIds) ? doc.data()?.memberIds : [];
        mids.forEach((id) => makeupMemberIds.add(id));
      });

      const nonMakeupDuplicates = duplicates.filter((id) => !makeupMemberIds.has(id));
      if (nonMakeupDuplicates.length > 0) {
        return NextResponse.json({ message: "MEMBER_ALREADY_IN_TEAM", duplicates: nonMakeupDuplicates }, { status: 409 });
      }

      const batch = db.batch();
      for (const doc of makeupTeamDocs) {
        const data = doc.data() ?? {};
        const mids: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
        const rids: string[] = Array.isArray(data.rosterIds) ? data.rosterIds : [];
        const removedIds = duplicates.filter((id) => mids.includes(id));
        if (removedIds.length === 0) continue;

        const newMids = mids.filter((id) => !removedIds.includes(id));
        const newRids = rids.filter((id) => !removedIds.includes(id));

        if (newMids.length === 0) {
          batch.delete(doc.ref);
          deleteTeamMemberships(batch, db, tournamentId, divisionId, eventId, removedIds);
        } else {
          const makeupUpdates: Record<string, unknown> = {
            memberIds: newMids,
            updatedAt: now,
          };
          if (rids.length > 0) makeupUpdates.rosterIds = newRids;
          batch.update(doc.ref, makeupUpdates);
          deleteTeamMemberships(batch, db, tournamentId, divisionId, eventId, removedIds);
        }
      }
      await batch.commit();
    }

    const playerDocs = await Promise.all(
      newMemberIds.map((pid) =>
        db.collection(firestorePaths.players(tournamentId)).doc(pid).get(),
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

  const batch = db.batch();
  batch.update(teamRef, updates);

  if (Array.isArray(body?.memberIds) && body.memberIds.length >= 1) {
    const newMemberIds: string[] = body.memberIds;
    const removedIds = currentMemberIds.filter((id) => !newMemberIds.includes(id));
    const addedOrRetainedIds = [...new Set(newMemberIds)];
    deleteTeamMemberships(batch, db, tournamentId, divisionId, eventId, removedIds);
    setTeamMemberships(batch, db, tournamentId, divisionId, eventId, teamId, addedOrRetainedIds, now);
  }

  await batch.commit();
  return NextResponse.json({ id: teamId, ...currentData, ...updates });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });

  const { tournamentId, divisionId, eventId, teamId } = ctx.params;
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;
  const teamRef = getTeamRef(tournamentId, divisionId, eventId, teamId);
  if (!teamRef) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) return NextResponse.json({ message: "TEAM_NOT_FOUND" }, { status: 404 });

  const teamData = teamDoc.data() ?? {};
  const memberIds: string[] = Array.isArray(teamData.memberIds) ? teamData.memberIds : [];
  const batch = db.batch();
  batch.delete(teamRef);
  deleteTeamMemberships(batch, db, tournamentId, divisionId, eventId, memberIds);
  await batch.commit();
  return NextResponse.json({ deleted: teamId });
}
