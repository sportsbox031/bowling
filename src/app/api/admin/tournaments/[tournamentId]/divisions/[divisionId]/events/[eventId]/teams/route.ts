import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import type { TeamType } from "@/lib/models";

type Ctx = { params: { tournamentId: string; divisionId: string; eventId: string } };

const getTeamsRef = (tournamentId: string, divisionId: string, eventId: string) => {
  if (!adminDb) return null;
  return adminDb.collection(firestorePaths.teams(tournamentId, divisionId, eventId));
};

/** 5인조 전반↔후반 연결된 이벤트 ID 조회 */
const getLinkedEventId = async (tournamentId: string, divisionId: string, eventId: string): Promise<string | null> => {
  if (!adminDb) return null;
  const eventDoc = await adminDb
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").doc(eventId).get();
  const data = eventDoc.data();
  if (!data || data.kind !== "FIVES" || !data.linkedEventId) return null;
  return data.linkedEventId as string;
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

  // 이미 다른 팀에 속한 선수 있는지 검증
  const existingSnap = await ref.get();
  const existingMemberIds = new Set<string>();
  for (const doc of existingSnap.docs) {
    const data = doc.data();
    const ids: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
    ids.forEach((id) => existingMemberIds.add(id));
  }
  const duplicates = memberIds.filter((id) => existingMemberIds.has(id));
  if (duplicates.length > 0) {
    return NextResponse.json({ message: "MEMBER_ALREADY_IN_TEAM", duplicates }, { status: 409 });
  }

  // 선수 소속 조회하여 팀 유형 결정
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const playerDocs = await Promise.all(
    memberIds.map((pid) =>
      adminDb!.collection(firestorePaths.players(tournamentId)).doc(pid).get()
    )
  );
  const affiliations = playerDocs.map((d) => (d.data()?.affiliation as string | undefined) ?? "");
  const groups = playerDocs.map((d) => (d.data()?.group as string | undefined) ?? "");
  const uniqueAffiliations = new Set(affiliations.filter(Boolean));
  const uniqueGroups = new Set(groups.filter(Boolean));

  const teamType: TeamType = memberIds.length >= 2 && uniqueAffiliations.size === 1 ? "NORMAL" : "MAKEUP";
  let teamName: string;
  if (nameOverride) {
    teamName = nameOverride;
  } else if (teamType === "NORMAL") {
    const baseName = [...uniqueAffiliations][0];
    const groupLabel = uniqueGroups.size === 1 ? [...uniqueGroups][0] : "";
    teamName = `${baseName}${groupLabel}`;
  } else {
    // MAKEUP: "혼성팀 N" — 현재 팀 수 기반
    const makeupCount = existingSnap.docs.filter((d) => d.data().teamType === "MAKEUP").length;
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
  await docRef.set(teamData);

  // 5인조: 연결된 이벤트에도 동일 팀 자동 생성
  const linkedEventId = await getLinkedEventId(tournamentId, divisionId, eventId);
  if (linkedEventId) {
    const linkedRef = getTeamsRef(tournamentId, divisionId, linkedEventId);
    if (linkedRef) {
      const linkedTeamData = {
        ...teamData,
        eventId: linkedEventId,
        linkedTeamId: docRef.id,
      };
      const linkedDocRef = linkedRef.doc();
      await linkedDocRef.set(linkedTeamData);
      // 원본 팀에도 연결 ID 기록
      await docRef.update({ linkedTeamId: linkedDocRef.id });
    }
  }

  return NextResponse.json({ id: docRef.id, ...teamData }, { status: 201 });
}
