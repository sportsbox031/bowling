import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { cloneFivesEventData, type AssignmentSeed, type ParticipantSeed, type SquadSeed, type TeamSeed } from "@/lib/fives-link";
import { setTeamMemberships } from "@/lib/admin/team-membership";
import { isFivesEventConfig } from "@/lib/fives-config";

const getEventRef = (tournamentId: string, divisionId: string, eventId: string) => {
  if (!adminDb) return null;
  return adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .doc(divisionId)
    .collection("events")
    .doc(eventId);
};

export async function POST(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string; sourceEventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const { tournamentId, divisionId, eventId, sourceEventId } = ctx.params;
  const targetRef = getEventRef(tournamentId, divisionId, eventId);
  const sourceRef = getEventRef(tournamentId, divisionId, sourceEventId);
  if (!targetRef || !sourceRef) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const [sourceDoc, targetDoc] = await Promise.all([sourceRef.get(), targetRef.get()]);
  if (!sourceDoc.exists || !targetDoc.exists) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const sourceData = sourceDoc.data() ?? {};
  const targetData = targetDoc.data() ?? {};
  if (sourceData.kind !== "FIVES" || targetData.kind !== "FIVES") {
    return NextResponse.json({ message: "FIVES_ONLY" }, { status: 400 });
  }
  if (isFivesEventConfig(sourceData.fivesConfig) || isFivesEventConfig(targetData.fivesConfig)) {
    return NextResponse.json({ message: "SINGLE_EVENT_FIVES_DOES_NOT_USE_COPY" }, { status: 409 });
  }
  if (targetData.halfType !== "SECOND") {
    return NextResponse.json({ message: "TARGET_MUST_BE_SECOND_HALF" }, { status: 400 });
  }
  if (targetData.linkedEventId && targetData.linkedEventId !== sourceEventId) {
    return NextResponse.json({ message: "LINKED_EVENT_MISMATCH" }, { status: 409 });
  }

  const [existingParticipants, existingSquads, existingTeams, existingAssignments] = await Promise.all([
    targetRef.collection("participants").limit(1).get(),
    targetRef.collection("squads").limit(1).get(),
    targetRef.collection("teams").limit(1).get(),
    targetRef.collection("assignments").limit(1).get(),
  ]);
  if (!existingParticipants.empty || !existingSquads.empty || !existingTeams.empty || !existingAssignments.empty) {
    return NextResponse.json({ message: "TARGET_ALREADY_INITIALIZED" }, { status: 409 });
  }

  const [participantsSnap, squadsSnap, teamsSnap, assignmentsSnap] = await Promise.all([
    sourceRef.collection("participants").get(),
    sourceRef.collection("squads").orderBy("createdAt").get(),
    sourceRef.collection("teams").orderBy("createdAt").get(),
    sourceRef.collection("assignments").orderBy("gameNumber").get(),
  ]);

  const now = new Date().toISOString();
  const cloned = cloneFivesEventData({
    sourceParticipants: participantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ParticipantSeed[],
    sourceSquads: squadsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as SquadSeed[],
    sourceTeams: teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TeamSeed[],
    sourceAssignments: assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as AssignmentSeed[],
    sourceGameCount: Number(sourceData.gameCount ?? 0),
    targetMeta: { tournamentId, divisionId, eventId },
    targetGameCount: Number(targetData.gameCount ?? 0),
    targetLaneRange: {
      start: Number(targetData.laneStart ?? 1),
      end: Number(targetData.laneEnd ?? 1),
    },
    targetTableShift: Number(targetData.tableShift ?? 0),
    now,
    createSquadId: () => targetRef.collection("squads").doc().id,
    createTeamId: () => targetRef.collection("teams").doc().id,
  });

  const batch = adminDb.batch();
  for (const squad of cloned.squads) {
    batch.set(targetRef.collection("squads").doc(squad.id), squad.data);
  }
  for (const participant of cloned.participants) {
    batch.set(targetRef.collection("participants").doc(participant.id), participant.data);
  }
  for (const team of cloned.teams) {
    batch.set(targetRef.collection("teams").doc(team.id), team.data);
    setTeamMemberships(batch, adminDb, tournamentId, divisionId, eventId, team.id, team.data.memberIds, now);
  }
  for (const assignment of cloned.assignments) {
    batch.set(targetRef.collection("assignments").doc(assignment.id), assignment.data);
  }
  await batch.commit();

  return NextResponse.json({
    message: "COPIED_FROM_FIRST_HALF",
    participants: cloned.participants.length,
    squads: cloned.squads.length,
    teams: cloned.teams.length,
    assignments: cloned.assignments.length,
  });
}
