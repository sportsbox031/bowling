import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { getApprovedOrganizationIdsForUser } from "@/lib/approved-organization-ids";
import { hasApprovedOrganizationAccess } from "@/lib/organization-membership-access";
import {
  assignEntryGroupsToTeams,
  buildAutoNamedTeams,
  buildTeamEntrySubmission,
  getRequiredTeamSize,
  normalizeTeamEntryTeams,
  validateNoDuplicatePlayersAcrossTeams,
} from "@/lib/submissions/team-entry";

type Ctx = { params: { tournamentId: string } };
type SubmissionRecord = {
  id: string;
  organizationId?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const snap = await db
    .collection(firestorePaths.teamEntrySubmissions(ctx.params.tournamentId))
    .where("coachUid", "==", session.uid)
    .get();
  const approvedOrganizationIds = await getApprovedOrganizationIdsForUser(db, session.uid);

  return NextResponse.json({
    items: snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as SubmissionRecord)
      .filter((item) => approvedOrganizationIds.has(String(item.organizationId ?? "").trim()))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const body = await req.json().catch(() => null) as {
    divisionId?: string;
    eventId?: string;
    organizationId?: string;
    teams?: unknown;
  } | null;

  const divisionId = String(body?.divisionId ?? "").trim();
  const eventId = String(body?.eventId ?? "").trim();
  const organizationId = String(body?.organizationId ?? "").trim();
  if (!divisionId || !eventId || !organizationId) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  if (!(await hasApprovedOrganizationAccess(db, session.uid, organizationId))) {
    return NextResponse.json({ message: "ORGANIZATION_FORBIDDEN" }, { status: 403 });
  }

  const eventSnap = await db.doc(firestorePaths.event(ctx.params.tournamentId, divisionId, eventId)).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const eventData = eventSnap.data() ?? {};
  const eventKind = String(eventData.kind ?? "") as "DOUBLES" | "TRIPLES" | "FIVES";
  if (!["DOUBLES", "TRIPLES", "FIVES"].includes(eventKind)) {
    return NextResponse.json({ message: "TEAM_EVENT_REQUIRED" }, { status: 409 });
  }

  const teams = normalizeTeamEntryTeams(eventKind, body?.teams);
  if (teams.length === 0 || !validateNoDuplicatePlayersAcrossTeams(teams) || !getRequiredTeamSize(eventKind)) {
    return NextResponse.json({ message: "INVALID_TEAMS" }, { status: 400 });
  }

  const allPlayerIds = [...new Set(teams.flatMap((team) => team.playerIds))];
  const playerSnaps = await Promise.all(
    allPlayerIds.map((playerId) => db.doc(firestorePaths.player(ctx.params.tournamentId, playerId)).get()),
  );
  const organizationSnap = await db.doc(firestorePaths.organization(organizationId)).get();
  if (playerSnaps.some((snap) => !snap.exists)) {
    return NextResponse.json({ message: "PLAYER_NOT_FOUND" }, { status: 404 });
  }

  const playerById = new Map(playerSnaps.map((snap) => [snap.id, snap.data() ?? {}]));
  for (const team of teams) {
    for (const playerId of team.playerIds) {
      const player = playerById.get(playerId) ?? {};
      if (String(player.divisionId ?? "") !== divisionId) {
        return NextResponse.json({ message: "DIVISION_MISMATCH" }, { status: 409 });
      }
      if (String(player.organizationId ?? "") !== organizationId) {
        return NextResponse.json({ message: "ORGANIZATION_MISMATCH" }, { status: 409 });
      }
    }
  }

  const resolvedTeams = assignEntryGroupsToTeams(teams, (playerId) => playerById.get(playerId));
  if (!resolvedTeams) {
    return NextResponse.json({ message: "ENTRY_GROUP_MISMATCH" }, { status: 409 });
  }
  const organizationName = String(organizationSnap.data()?.name ?? "").trim();
  const autoNamedTeams = buildAutoNamedTeams(organizationName, resolvedTeams);

  const submissionsRef = db.collection(firestorePaths.teamEntrySubmissions(ctx.params.tournamentId));
  const submissionRef = submissionsRef.doc();
  const now = new Date().toISOString();
  const submission = buildTeamEntrySubmission(submissionRef.id, {
    tournamentId: ctx.params.tournamentId,
    divisionId,
    eventId,
    organizationId,
    coachUid: session.uid,
    teams: autoNamedTeams,
  }, now);

  await submissionRef.set(submission);
  return NextResponse.json({ item: submission }, { status: 201 });
}
