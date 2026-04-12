import { adminDb } from "../src/lib/firebase/admin.ts";
import { mergeLegacyFivesEvents } from "../src/lib/fives-migration.ts";
import { pathToFileURL } from "node:url";
import { rebuildEventScoreboardAggregate } from "../src/lib/aggregates/event-scoreboard.ts";
import { rebuildOverallAggregate } from "../src/lib/aggregates/overall.ts";
import { rebuildPublicTournamentAggregate } from "../src/lib/aggregates/public-tournament.ts";

type LegacyFivesEvent = {
  id: string;
  divisionId: string;
  title: string;
  kind: string;
  gameCount: number;
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
  linkedEventId?: string;
  halfType?: string;
  fivesConfig?: { firstHalfGameCount: number; secondHalfGameCount: number };
};

const hasSingleEventFivesConfig = (value: unknown): value is { firstHalfGameCount: number; secondHalfGameCount: number } => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Number.isFinite(record.firstHalfGameCount) && Number.isFinite(record.secondHalfGameCount);
};

const readCollection = async (ref: FirebaseFirestore.CollectionReference) =>
  (await ref.get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));

const clearCollection = async (ref: FirebaseFirestore.CollectionReference) => {
  const snap = await ref.get();
  if (snap.empty || !adminDb) return;

  for (let index = 0; index < snap.docs.length; index += 400) {
    const batch = adminDb.batch();
    snap.docs.slice(index, index + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
};

const commitChunkedWrites = async (
  db: FirebaseFirestore.Firestore,
  builders: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
) => {
  for (let index = 0; index < builders.length; index += 400) {
    const batch = db.batch();
    builders.slice(index, index + 400).forEach((build) => build(batch));
    await batch.commit();
  }
};

export async function main() {
  if (!adminDb) {
    throw new Error("ADMIN_FIRESTORE_NOT_READY");
  }

  const apply = process.argv.includes("--apply");
  const tournamentId = process.argv.find((arg) => arg.startsWith("--tournament="))?.split("=")[1];
  if (!tournamentId) {
    throw new Error("TOURNAMENT_ID_REQUIRED (--tournament=<id>)");
  }

  const tournamentRef = adminDb.collection("tournaments").doc(tournamentId);
  const divisionsSnap = await tournamentRef.collection("divisions").get();

  for (const divisionDoc of divisionsSnap.docs) {
    const divisionId = divisionDoc.id;
    const eventsSnap = await divisionDoc.ref.collection("events").get();
    const events = eventsSnap.docs
      .map((doc) => ({ id: doc.id, divisionId, ...doc.data() } as LegacyFivesEvent))
      .filter((event) => event.kind === "FIVES");

    const firstHalfEvents = events.filter((event) => event.halfType === "FIRST" && !hasSingleEventFivesConfig(event.fivesConfig));
    if (firstHalfEvents.length === 0) {
      continue;
    }

    console.log(`[fives-migrate] division ${divisionId}: legacy first-half events ${firstHalfEvents.length}`);

    for (const firstEvent of firstHalfEvents) {
      const secondEvent = events.find((event) => event.id !== firstEvent.id && event.linkedEventId === firstEvent.id && event.halfType === "SECOND");
      if (!secondEvent) {
        console.log(`[fives-migrate] skip ${firstEvent.id}: linked second-half event not found`);
        continue;
      }

      const firstRef = divisionDoc.ref.collection("events").doc(firstEvent.id);
      const secondRef = divisionDoc.ref.collection("events").doc(secondEvent.id);

      const [
        firstParticipants,
        secondParticipants,
        firstSquads,
        secondSquads,
        firstTeams,
        secondTeams,
        firstAssignments,
        secondAssignments,
        firstScores,
        secondScores,
      ] = await Promise.all([
        readCollection(firstRef.collection("participants")),
        readCollection(secondRef.collection("participants")),
        readCollection(firstRef.collection("squads")),
        readCollection(secondRef.collection("squads")),
        readCollection(firstRef.collection("teams")),
        readCollection(secondRef.collection("teams")),
        readCollection(firstRef.collection("assignments")),
        readCollection(secondRef.collection("assignments")),
        readCollection(firstRef.collection("scores")),
        readCollection(secondRef.collection("scores")),
      ]);

      const merged = mergeLegacyFivesEvents({
        firstEvent,
        secondEvent,
        firstParticipants,
        secondParticipants,
        firstSquads,
        secondSquads,
        firstTeams,
        secondTeams,
        firstAssignments,
        secondAssignments,
        firstScores,
        secondScores,
        now: new Date().toISOString(),
      });

      console.log(`[fives-migrate] ${firstEvent.id} + ${secondEvent.id} -> ${merged.event.gameCount}G, teams=${merged.teams.length}, scores=${merged.scores.length}, assignments=${merged.assignments.length}`);

      if (!apply) {
        continue;
      }

      await Promise.all([
        clearCollection(firstRef.collection("participants")),
        clearCollection(firstRef.collection("squads")),
        clearCollection(firstRef.collection("teams")),
        clearCollection(firstRef.collection("teamMembers")),
        clearCollection(firstRef.collection("assignments")),
        clearCollection(firstRef.collection("scores")),
      ]);

      await firstRef.set({
        ...merged.event,
        linkedEventId: null,
        halfType: null,
        hidden: false,
        migratedFromEventIds: [secondEvent.id],
      }, { merge: true });

      const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
      merged.participants.forEach((participant) => {
        writes.push((batch) => batch.set(firstRef.collection("participants").doc(participant.id), participant.data));
      });
      merged.squads.forEach((squad) => {
        writes.push((batch) => batch.set(firstRef.collection("squads").doc(squad.id), squad.data));
      });
      merged.teams.forEach((team) => {
        writes.push((batch) => batch.set(firstRef.collection("teams").doc(team.id), team.data));
        Array.from(new Set(team.data.rosterIds)).forEach((playerId) => {
          writes.push((batch) => batch.set(firstRef.collection("teamMembers").doc(playerId), {
            playerId,
            teamId: team.id,
            updatedAt: merged.event.updatedAt ?? merged.event.createdAt ?? new Date().toISOString(),
          }));
        });
      });
      merged.assignments.forEach((assignment) => {
        writes.push((batch) => batch.set(firstRef.collection("assignments").doc(assignment.id), assignment.data));
      });
      merged.scores.forEach((score) => {
        writes.push((batch) => batch.set(firstRef.collection("scores").doc(score.id), score.data));
      });

      await commitChunkedWrites(adminDb, writes);

      await secondRef.set({
        hidden: true,
        migratedToEventId: firstEvent.id,
        migratedAt: merged.event.updatedAt ?? new Date().toISOString(),
        migrationKind: "FIVES_SINGLE_EVENT",
      }, { merge: true });

      await Promise.all([
        rebuildEventScoreboardAggregate(adminDb, tournamentId, divisionId, firstEvent.id),
        rebuildOverallAggregate(adminDb, tournamentId, divisionId),
        rebuildOverallAggregate(adminDb, tournamentId),
        rebuildPublicTournamentAggregate(adminDb, tournamentId),
      ]);

      console.log(`[fives-migrate] applied ${firstEvent.id} <- ${secondEvent.id}`);
    }
  }

  if (!apply) {
    console.log("[fives-migrate] dry-run complete");
  }
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  main().catch((error) => {
    console.error("[fives-migrate] failed", error);
    process.exitCode = 1;
  });
}
