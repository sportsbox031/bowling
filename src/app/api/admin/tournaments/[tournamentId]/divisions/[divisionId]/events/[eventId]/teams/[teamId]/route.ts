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

/** PUT: 팀 멤버 또는 이름 수정 */
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

  if (Array.isArray(body?.memberIds) && body.memberIds.length >= 2) {
    const newMemberIds: string[] = body.memberIds;

    // 다른 팀에 이미 속한 선수인지 검증 (자기 팀 제외)
    const teamsRef = adminDb.collection(firestorePaths.teams(tournamentId, divisionId, eventId));
    const allTeamsSnap = await teamsRef.get();
    const otherTeamMemberIds = new Set<string>();
    for (const doc of allTeamsSnap.docs) {
      if (doc.id === teamId) continue;
      const ids: string[] = Array.isArray(doc.data().memberIds) ? doc.data().memberIds : [];
      ids.forEach((id) => otherTeamMemberIds.add(id));
    }
    const duplicates = newMemberIds.filter((id) => otherTeamMemberIds.has(id));
    if (duplicates.length > 0) {
      return NextResponse.json({ message: "MEMBER_ALREADY_IN_TEAM", duplicates }, { status: 409 });
    }

    // 소속 재계산
    const playerDocs = await Promise.all(
      newMemberIds.map((pid) =>
        adminDb!.collection(firestorePaths.players(tournamentId)).doc(pid).get()
      )
    );
    const affiliations = playerDocs.map((d) => (d.data()?.affiliation as string | undefined) ?? "");
    const uniqueAffiliations = new Set(affiliations.filter(Boolean));
    const teamType: TeamType = uniqueAffiliations.size === 1 ? "NORMAL" : "MAKEUP";

    updates.memberIds = newMemberIds;
    updates.teamType = teamType;

    // 이름 override 없으면 teamType 기반 자동 갱신
    if (typeof body?.name !== "string") {
      if (teamType === "NORMAL") {
        updates.name = [...uniqueAffiliations][0];
      }
      // MAKEUP이면 기존 이름 유지
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

/** DELETE: 팀 삭제 (선수 점수는 유지됨) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });

  const { tournamentId, divisionId, eventId, teamId } = ctx.params;
  const teamRef = getTeamRef(tournamentId, divisionId, eventId, teamId);
  if (!teamRef) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) return NextResponse.json({ message: "TEAM_NOT_FOUND" }, { status: 404 });

  await teamRef.delete();
  return NextResponse.json({ deleted: teamId });
}
