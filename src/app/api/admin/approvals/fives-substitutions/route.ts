import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";

type SubmissionRecord = {
  id: string;
  divisionId?: string;
  eventId?: string;
  organizationId?: string;
  coachUid?: string;
  teamId?: string;
  firstHalfMemberIds?: unknown;
  secondHalfMemberIds?: unknown;
  rosterIds?: unknown;
  createdAt?: string;
  [key: string]: unknown;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];

export async function GET(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const searchParams = new URL(req.url).searchParams;
  const tournamentId = String(searchParams.get("tournamentId") ?? "").trim();
  const divisionId = String(searchParams.get("divisionId") ?? "").trim();
  if (!tournamentId) {
    return NextResponse.json({ message: "TOURNAMENT_ID_REQUIRED" }, { status: 400 });
  }

  let query = db
    .collection(firestorePaths.fivesSubstitutionSubmissions(tournamentId))
    .where("status", "==", "SUBMITTED");
  if (divisionId) {
    query = query.where("divisionId", "==", divisionId);
  }

  const snap = await query.get();
  const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as SubmissionRecord[];
  items.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));

  const divisionIds = [...new Set(items.map((item) => String(item.divisionId ?? "").trim()).filter(Boolean))];
  const organizationIds = [...new Set(items.map((item) => String(item.organizationId ?? "").trim()).filter(Boolean))];
  const coachUids = [...new Set(items.map((item) => String(item.coachUid ?? "").trim()).filter(Boolean))];
  const eventKeys = [...new Set(
    items.map((item) => `${String(item.divisionId ?? "").trim()}::${String(item.eventId ?? "").trim()}`).filter(Boolean),
  )];
  const teamKeys = items.map((item) => ({
    divisionId: String(item.divisionId ?? "").trim(),
    eventId: String(item.eventId ?? "").trim(),
    teamId: String(item.teamId ?? "").trim(),
  }));
  const playerIds = [...new Set(
    items.flatMap((item) => [
      ...toStringArray(item.firstHalfMemberIds),
      ...toStringArray(item.secondHalfMemberIds),
      ...toStringArray(item.rosterIds),
    ]),
  )];

  const [divisionSnaps, organizationSnaps, coachSnaps, eventSnaps, teamSnaps, playerSnaps] = await Promise.all([
    Promise.all(divisionIds.map((id) => db.doc(firestorePaths.division(tournamentId, id)).get())),
    Promise.all(organizationIds.map((id) => db.doc(firestorePaths.organization(id)).get())),
    Promise.all(coachUids.map((uid) => db.doc(firestorePaths.user(uid)).get())),
    Promise.all(eventKeys.map((key) => {
      const [nextDivisionId, nextEventId] = key.split("::");
      return db.doc(firestorePaths.event(tournamentId, nextDivisionId, nextEventId)).get();
    })),
    Promise.all(teamKeys.map((key) => db.doc(firestorePaths.team(tournamentId, key.divisionId, key.eventId, key.teamId)).get())),
    Promise.all(playerIds.map((id) => db.doc(firestorePaths.player(tournamentId, id)).get())),
  ]);

  const divisionTitleById = new Map(divisionSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, String(doc.data()?.title ?? doc.id)]));
  const organizationNameById = new Map(organizationSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, String(doc.data()?.name ?? doc.id)]));
  const coachNameById = new Map(coachSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, String(doc.data()?.name ?? doc.id)]));
  const eventTitleByKey = new Map(eventSnaps.filter((doc) => doc.exists).map((doc) => [`${String(doc.data()?.divisionId ?? "")}::${doc.id}`, String(doc.data()?.title ?? doc.id)]));
  const teamNameById = new Map(teamSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, String(doc.data()?.name ?? doc.id)]));
  const playerLabelById = new Map(
    playerSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, `${Number(doc.data()?.number ?? 0)}. ${String(doc.data()?.name ?? doc.id)}`]),
  );

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      divisionTitle: divisionTitleById.get(String(item.divisionId ?? "")) ?? String(item.divisionId ?? ""),
      organizationName: organizationNameById.get(String(item.organizationId ?? "")) ?? String(item.organizationId ?? ""),
      coachName: coachNameById.get(String(item.coachUid ?? "")) ?? String(item.coachUid ?? ""),
      eventTitle: eventTitleByKey.get(`${String(item.divisionId ?? "")}::${String(item.eventId ?? "")}`) ?? String(item.eventId ?? ""),
      teamName: teamNameById.get(String(item.teamId ?? "")) ?? String(item.teamId ?? ""),
      firstHalfPlayerLabels: toStringArray(item.firstHalfMemberIds).map((playerId) => playerLabelById.get(playerId) ?? playerId),
      secondHalfPlayerLabels: toStringArray(item.secondHalfMemberIds).map((playerId) => playerLabelById.get(playerId) ?? playerId),
      rosterPlayerLabels: toStringArray(item.rosterIds).map((playerId) => playerLabelById.get(playerId) ?? playerId),
    })),
  });
}
