import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { getApprovedOrganizationIdsForUser } from "@/lib/approved-organization-ids";
import { hasApprovedOrganizationAccess } from "@/lib/organization-membership-access";
import {
  buildFivesSubstitutionSubmission,
  isValidFivesSubstitution,
  normalizeFivesSubstitutionPayload,
} from "@/lib/submissions/fives-substitution";
import { isFivesSubstitutionWindowOpen } from "@/lib/fives-substitution-window";

type Ctx = { params: { tournamentId: string } };

type TeamEntrySubmissionRecord = {
  id: string;
  coachUid?: string;
  organizationId?: string;
  divisionId?: string;
  eventId?: string;
  status?: string;
  projectedTeamIds?: unknown;
  [key: string]: unknown;
};

type TeamRecord = {
  id: string;
  name?: string;
  rosterIds?: unknown;
  firstHalfMemberIds?: unknown;
  secondHalfMemberIds?: unknown;
  [key: string]: unknown;
};

type FivesSubstitutionRecord = {
  id: string;
  teamId?: string;
  status?: string;
  secondHalfMemberIds?: unknown;
  createdAt?: string;
  rejectionReason?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

const getItemState = (submission: FivesSubstitutionRecord | undefined, windowOpen: boolean) => {
  const status = String(submission?.status ?? "").trim();

  if (status === "SUBMITTED") {
    return { status: "SUBMITTED", canSubmit: false, message: "관리자 승인 대기 중입니다." };
  }

  if (status === "APPROVED") {
    return { status: "APPROVED", canSubmit: false, message: "후반 교체가 승인되었습니다." };
  }

  if (status === "REJECTED") {
    return {
      status: "REJECTED",
      canSubmit: windowOpen,
      message: submission?.rejectionReason
        ? `반려 사유: ${submission.rejectionReason}`
        : "반려된 제출입니다. 수정 후 다시 제출할 수 있습니다.",
    };
  }

  if (windowOpen) {
    return { status: "READY", canSubmit: true, message: "" };
  }

  return {
    status: "WAITING_OPEN",
    canSubmit: false,
    message: "전반 점수 입력이 완료되면 후반 교체 제출이 자동으로 열립니다.",
  };
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const approvedOrganizationIds = await getApprovedOrganizationIdsForUser(db, session.uid);
  const teamSubmissionSnap = await db
    .collection(firestorePaths.teamEntrySubmissions(ctx.params.tournamentId))
    .where("coachUid", "==", session.uid)
    .where("status", "==", "APPROVED")
    .get();
  const substitutionSnap = await db
    .collection(firestorePaths.fivesSubstitutionSubmissions(ctx.params.tournamentId))
    .where("coachUid", "==", session.uid)
    .get();

  const approvedTeamSubmissions = teamSubmissionSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as TeamEntrySubmissionRecord)
    .filter((item) => approvedOrganizationIds.has(String(item.organizationId ?? "").trim()));

  const eventKeys = [...new Set(
    approvedTeamSubmissions.map((item) => `${String(item.divisionId ?? "").trim()}::${String(item.eventId ?? "").trim()}`),
  )];
  const organizationIds = [...new Set(
    approvedTeamSubmissions.map((item) => String(item.organizationId ?? "").trim()).filter(Boolean),
  )];
  const divisionIds = [...new Set(
    approvedTeamSubmissions.map((item) => String(item.divisionId ?? "").trim()).filter(Boolean),
  )];

  const [eventSnaps, organizationSnaps, divisionSnaps] = await Promise.all([
    Promise.all(
      eventKeys
        .filter((value) => !value.startsWith("::") && !value.endsWith("::"))
        .map((key) => {
          const [divisionId, eventId] = key.split("::");
          return db.doc(firestorePaths.event(ctx.params.tournamentId, divisionId, eventId)).get();
        }),
    ),
    Promise.all(organizationIds.map((organizationId) => db.doc(firestorePaths.organization(organizationId)).get())),
    Promise.all(divisionIds.map((divisionId) => db.doc(firestorePaths.division(ctx.params.tournamentId, divisionId)).get())),
  ]);

  const eventByKey = new Map(
    eventSnaps
      .filter((snap) => snap.exists)
      .map((snap) => [`${String(snap.data()?.divisionId ?? "")}::${snap.id}`, snap.data() as Record<string, unknown>]),
  );
  const organizationNameById = new Map(
    organizationSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, String(snap.data()?.name ?? snap.id)]),
  );
  const divisionTitleById = new Map(
    divisionSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, String(snap.data()?.title ?? snap.id)]),
  );

  const fivesTeamDescriptors = approvedTeamSubmissions.flatMap((submission) => {
    const divisionId = String(submission.divisionId ?? "").trim();
    const eventId = String(submission.eventId ?? "").trim();
    const eventData = eventByKey.get(`${divisionId}::${eventId}`) ?? {};
    if (String(eventData.kind ?? "") !== "FIVES") {
      return [];
    }

    return toStringArray(submission.projectedTeamIds).map((teamId) => ({
      submission,
      teamId,
      divisionId,
      eventId,
      eventTitle: String(eventData.title ?? eventId),
    }));
  });

  const scoreDocsByEventKey = new Map<string, Array<Record<string, unknown>>>();

  const teamSnaps = await Promise.all(
    fivesTeamDescriptors.map((descriptor) =>
      db.doc(firestorePaths.team(ctx.params.tournamentId, descriptor.divisionId, descriptor.eventId, descriptor.teamId)).get(),
    ),
  );
  const teamById = new Map<string, TeamRecord>(
    teamSnaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, { id: snap.id, ...(snap.data() as Record<string, unknown>) } as TeamRecord] as const),
  );

  const uniqueScoreEventKeys = [...new Set(fivesTeamDescriptors.map((descriptor) => `${descriptor.divisionId}::${descriptor.eventId}`))];
  const scoreSnaps = await Promise.all(
    uniqueScoreEventKeys.map((key) => {
      const [divisionId, eventId] = key.split("::");
      return db.collection(firestorePaths.scores(ctx.params.tournamentId, divisionId, eventId)).get();
    }),
  );
  uniqueScoreEventKeys.forEach((key, index) => {
    scoreDocsByEventKey.set(
      key,
      scoreSnaps[index]?.docs.map((doc) => doc.data() as Record<string, unknown>) ?? [],
    );
  });

  const playerIds = [...new Set(
    [...teamById.values()].flatMap((team) => toStringArray(team.rosterIds ?? team.firstHalfMemberIds ?? [])),
  )];
  const playerSnaps = await Promise.all(playerIds.map((playerId) => db.doc(firestorePaths.player(ctx.params.tournamentId, playerId)).get()));
  const playerById = new Map(
    playerSnaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() as Record<string, unknown>]),
  );

  const substitutionByTeamId = new Map<string, FivesSubstitutionRecord>();
  for (const doc of substitutionSnap.docs) {
    const item = { id: doc.id, ...(doc.data() as Record<string, unknown>) } as FivesSubstitutionRecord;
    const teamId = String(item.teamId ?? "").trim();
    if (!teamId) continue;
    const current = substitutionByTeamId.get(teamId);
    if (!current || String(current.updatedAt ?? current.createdAt ?? "") < String(item.updatedAt ?? item.createdAt ?? "")) {
      substitutionByTeamId.set(teamId, item);
    }
  }

  const items = fivesTeamDescriptors
    .map((descriptor) => {
      const team = teamById.get(descriptor.teamId) as TeamRecord | undefined;
      if (!team) {
        return null;
      }

      const scoreKey = `${descriptor.divisionId}::${descriptor.eventId}`;
      const scoreDocs = scoreDocsByEventKey.get(scoreKey) ?? [];
      const scoreKeys = new Set(
        scoreDocs.map((score) => `${String(score.playerId ?? "")}:${Number(score.gameNumber ?? 0)}`),
      );
      const rosterIds = toStringArray(team.rosterIds ?? team.firstHalfMemberIds ?? []);
      const firstHalfMemberIds = toStringArray(team.firstHalfMemberIds ?? team.secondHalfMemberIds ?? []);
      const latestSubmission = substitutionByTeamId.get(descriptor.teamId);
      const eventData = eventByKey.get(`${descriptor.divisionId}::${descriptor.eventId}`) ?? {};
      const windowOpen = isFivesSubstitutionWindowOpen(
        {
          gameCount: eventData.gameCount,
          fivesConfig: eventData.fivesConfig,
        },
        team,
        scoreKeys,
      );
      const state = getItemState(latestSubmission, windowOpen);

      return {
        teamId: descriptor.teamId,
        teamEntrySubmissionId: descriptor.submission.id,
        organizationId: String(descriptor.submission.organizationId ?? ""),
        organizationName: organizationNameById.get(String(descriptor.submission.organizationId ?? "")) ?? String(descriptor.submission.organizationId ?? ""),
        divisionId: descriptor.divisionId,
        divisionTitle: divisionTitleById.get(descriptor.divisionId) ?? descriptor.divisionId,
        eventId: descriptor.eventId,
        eventTitle: descriptor.eventTitle,
        teamName: String(team.name ?? descriptor.teamId),
        roster: rosterIds.map((playerId) => ({
          id: playerId,
          number: Number(playerById.get(playerId)?.number ?? 0),
          name: String(playerById.get(playerId)?.name ?? playerId),
          affiliation: String(playerById.get(playerId)?.affiliation ?? ""),
          region: String(playerById.get(playerId)?.region ?? ""),
          entryGroup: String(playerById.get(playerId)?.entryGroup ?? "") as "A" | "B" | "",
        })),
        firstHalfMemberIds,
        windowOpen,
        canSubmit: state.canSubmit,
        status: state.status,
        message: state.message,
        submission: latestSubmission
          ? {
              id: latestSubmission.id,
              status: String(latestSubmission.status ?? ""),
              createdAt: String(latestSubmission.createdAt ?? ""),
              rejectionReason: String(latestSubmission.rejectionReason ?? ""),
              secondHalfMemberIds: toStringArray(latestSubmission.secondHalfMemberIds),
            }
          : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      `${a?.divisionTitle ?? ""} ${a?.eventTitle ?? ""} ${a?.teamName ?? ""}`.localeCompare(
        `${b?.divisionTitle ?? ""} ${b?.eventTitle ?? ""} ${b?.teamName ?? ""}`,
      ),
    );

  return NextResponse.json({
    items,
    summary: {
      approvedTeamCount: items.length,
      readyCount: items.filter((item) => item?.status === "READY").length,
      submittedCount: items.filter((item) => item?.status === "SUBMITTED").length,
      approvedCount: items.filter((item) => item?.status === "APPROVED").length,
      rejectedCount: items.filter((item) => item?.status === "REJECTED").length,
    },
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
    teamId?: string;
    teamEntrySubmissionId?: string;
    secondHalfMemberIds?: unknown;
  } | null;

  const divisionId = String(body?.divisionId ?? "").trim();
  const eventId = String(body?.eventId ?? "").trim();
  const organizationId = String(body?.organizationId ?? "").trim();
  const teamId = String(body?.teamId ?? "").trim();
  const teamEntrySubmissionId = String(body?.teamEntrySubmissionId ?? "").trim();
  if (!divisionId || !eventId || !organizationId || !teamId || !teamEntrySubmissionId) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  if (!(await hasApprovedOrganizationAccess(db, session.uid, organizationId))) {
    return NextResponse.json({ message: "ORGANIZATION_FORBIDDEN" }, { status: 403 });
  }

  const [eventSnap, teamEntrySubmissionSnap, teamSnap] = await Promise.all([
    db.doc(firestorePaths.event(ctx.params.tournamentId, divisionId, eventId)).get(),
    db.doc(firestorePaths.teamEntrySubmission(ctx.params.tournamentId, teamEntrySubmissionId)).get(),
    db.doc(firestorePaths.team(ctx.params.tournamentId, divisionId, eventId, teamId)).get(),
  ]);

  if (!eventSnap.exists || !teamEntrySubmissionSnap.exists || !teamSnap.exists) {
    return NextResponse.json({ message: "RESOURCE_NOT_FOUND" }, { status: 404 });
  }

  const eventData = eventSnap.data() ?? {};
  if (String(eventData.kind ?? "") !== "FIVES") {
    return NextResponse.json({ message: "FIVES_EVENT_REQUIRED" }, { status: 409 });
  }
  const scoreSnap = await db.collection(firestorePaths.scores(ctx.params.tournamentId, divisionId, eventId)).get();
  const scoreKeys = new Set(
    scoreSnap.docs.map((doc) => `${String(doc.data()?.playerId ?? "")}:${Number(doc.data()?.gameNumber ?? 0)}`),
  );
  if (!isFivesSubstitutionWindowOpen(
    {
      gameCount: eventData.gameCount,
      fivesConfig: eventData.fivesConfig,
    },
    teamSnap.data() ?? {},
    scoreKeys,
  )) {
    return NextResponse.json({ message: "SUBSTITUTION_WINDOW_CLOSED" }, { status: 409 });
  }

  const teamEntrySubmission = teamEntrySubmissionSnap.data() ?? {};
  if (
    String(teamEntrySubmission.coachUid ?? "") !== session.uid
    || String(teamEntrySubmission.organizationId ?? "") !== organizationId
    || String(teamEntrySubmission.divisionId ?? "") !== divisionId
    || String(teamEntrySubmission.eventId ?? "") !== eventId
    || String(teamEntrySubmission.status ?? "") !== "APPROVED"
    || !toStringArray(teamEntrySubmission.projectedTeamIds).includes(teamId)
  ) {
    return NextResponse.json({ message: "TEAM_SUBMISSION_FORBIDDEN" }, { status: 403 });
  }

  const teamData = teamSnap.data() ?? {};
  const normalizedPayload = normalizeFivesSubstitutionPayload({
    rosterIds: toStringArray(teamData.rosterIds ?? teamData.firstHalfMemberIds ?? teamData.memberIds ?? []),
    firstHalfMemberIds: toStringArray(teamData.firstHalfMemberIds ?? teamData.memberIds ?? []),
    secondHalfMemberIds: body?.secondHalfMemberIds,
  });
  if (!isValidFivesSubstitution(normalizedPayload)) {
    return NextResponse.json({ message: "INVALID_LINEUP" }, { status: 400 });
  }

  const existingSnap = await db
    .collection(firestorePaths.fivesSubstitutionSubmissions(ctx.params.tournamentId))
    .where("coachUid", "==", session.uid)
    .where("teamId", "==", teamId)
    .get();
  const existingItems = existingSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as FivesSubstitutionRecord[];
  if (existingItems.some((item) => ["SUBMITTED", "APPROVED"].includes(String(item.status ?? "")))) {
    return NextResponse.json({ message: "SUBSTITUTION_ALREADY_EXISTS" }, { status: 409 });
  }

  const playerSnaps = await Promise.all(
    normalizedPayload.rosterIds.map((playerId) => db.doc(firestorePaths.player(ctx.params.tournamentId, playerId)).get()),
  );
  if (playerSnaps.some((snap) => !snap.exists)) {
    return NextResponse.json({ message: "PLAYER_NOT_FOUND" }, { status: 404 });
  }

  const submissionRef = db.collection(firestorePaths.fivesSubstitutionSubmissions(ctx.params.tournamentId)).doc();
  const now = new Date().toISOString();
  const submission = buildFivesSubstitutionSubmission(submissionRef.id, {
    tournamentId: ctx.params.tournamentId,
    divisionId,
    eventId,
    organizationId,
    coachUid: session.uid,
    teamId,
    teamEntrySubmissionId,
    rosterIds: normalizedPayload.rosterIds,
    firstHalfMemberIds: normalizedPayload.firstHalfMemberIds,
    secondHalfMemberIds: normalizedPayload.secondHalfMemberIds,
  }, now);

  await submissionRef.set(submission);
  return NextResponse.json({ item: submission }, { status: 201 });
}
