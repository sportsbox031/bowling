import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";

type SubmissionTeamRecord = {
  playerIds?: unknown[];
  firstHalfMemberIds?: unknown[];
  secondHalfMemberIds?: unknown[];
  [key: string]: unknown;
};

type TeamSubmissionRecord = {
  id: string;
  createdAt?: string;
  coachUid?: string;
  organizationId?: string;
  divisionId?: string;
  eventId?: string;
  teams?: SubmissionTeamRecord[];
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const tournamentId = new URL(req.url).searchParams.get("tournamentId");
  const divisionId = new URL(req.url).searchParams.get("divisionId");
  if (!tournamentId) {
    return NextResponse.json({ message: "TOURNAMENT_ID_REQUIRED" }, { status: 400 });
  }

  let query = db
    .collection(firestorePaths.teamEntrySubmissions(tournamentId))
    .where("status", "==", "SUBMITTED");

  if (divisionId) {
    query = query.where("divisionId", "==", divisionId);
  }

  const snap = await query.get();

  const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as TeamSubmissionRecord[];
  items.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
  const coachUids = [...new Set(items.map((item) => String(item.coachUid ?? "").trim()).filter(Boolean))];
  const organizationIds = [...new Set(items.map((item) => String(item.organizationId ?? "").trim()).filter(Boolean))];
  const divisionIds = [...new Set(items.map((item) => String(item.divisionId ?? "").trim()).filter(Boolean))];
  const eventKeys = [...new Set(items.map((item) => `${String(item.divisionId ?? "").trim()}::${String(item.eventId ?? "").trim()}`).filter((value) => !value.startsWith("::") && !value.endsWith("::")))];
  const playerIds = [...new Set(
    items.flatMap((item) =>
      Array.isArray(item.teams)
        ? item.teams.flatMap((team) => Array.isArray(team.playerIds) ? team.playerIds.map((playerId) => String(playerId ?? "").trim()).filter(Boolean) : [])
        : [],
    ),
  )];

  const [coachSnaps, organizationSnaps, divisionSnaps, eventSnaps, playerSnaps] = await Promise.all([
    Promise.all(coachUids.map((uid) => db.doc(firestorePaths.user(uid)).get())),
    Promise.all(organizationIds.map((organizationId) => db.doc(firestorePaths.organization(organizationId)).get())),
    Promise.all(divisionIds.map((divisionId) => db.doc(firestorePaths.division(tournamentId, divisionId)).get())),
    Promise.all(eventKeys.map((key) => {
      const [divisionId, eventId] = key.split("::");
      return db.doc(firestorePaths.event(tournamentId, divisionId, eventId)).get();
    })),
    Promise.all(playerIds.map((playerId) => db.doc(firestorePaths.player(tournamentId, playerId)).get())),
  ]);

  const coachNameByUid = new Map(coachSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, String(doc.data()?.name ?? "")]));
  const organizationNameById = new Map(organizationSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, String(doc.data()?.name ?? "")]));
  const divisionTitleById = new Map(divisionSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, String(doc.data()?.title ?? "")]));
  const eventTitleByKey = new Map(eventSnaps.filter((doc) => doc.exists).map((doc) => [`${String(doc.data()?.divisionId ?? "")}::${doc.id}`, String(doc.data()?.title ?? "")]));
  const playerLabelById = new Map(
    playerSnaps
      .filter((doc) => doc.exists)
      .map((doc) => [doc.id, `${Number(doc.data()?.number ?? 0)}. ${String(doc.data()?.name ?? doc.id)}`]),
  );

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      coachName: coachNameByUid.get(String(item.coachUid ?? "")) ?? "",
      organizationName: organizationNameById.get(String(item.organizationId ?? "")) ?? "",
      divisionTitle: divisionTitleById.get(String(item.divisionId ?? "")) ?? "",
      eventTitle: eventTitleByKey.get(`${String(item.divisionId ?? "")}::${String(item.eventId ?? "")}`) ?? "",
      teams: Array.isArray(item.teams)
        ? item.teams.map((team) => ({
            ...team,
            playerLabels: Array.isArray(team.playerIds)
              ? team.playerIds.map((playerId) => playerLabelById.get(String(playerId ?? "").trim()) ?? String(playerId ?? ""))
              : [],
            firstHalfPlayerLabels: Array.isArray(team.firstHalfMemberIds)
              ? team.firstHalfMemberIds.map((playerId) => playerLabelById.get(String(playerId ?? "").trim()) ?? String(playerId ?? ""))
              : [],
            secondHalfPlayerLabels: Array.isArray(team.secondHalfMemberIds)
              ? team.secondHalfMemberIds.map((playerId) => playerLabelById.get(String(playerId ?? "").trim()) ?? String(playerId ?? ""))
              : [],
          }))
        : [],
    })),
  });
}
