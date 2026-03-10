import { adminDb } from "../src/lib/firebase/admin.ts";
import { rebuildPlayerRankingsAggregate } from "../src/lib/aggregates/player-rankings.ts";
import { rebuildOverallAggregate } from "../src/lib/aggregates/overall.ts";
import { rebuildEventScoreboardAggregate } from "../src/lib/aggregates/event-scoreboard.ts";
import { rebuildPlayerProfileAggregate } from "../src/lib/aggregates/player-profile.ts";
import { rebuildPublicTournamentAggregate, rebuildPublicTournamentListAggregate } from "../src/lib/aggregates/public-tournament.ts";

async function main() {
  if (!adminDb) {
    throw new Error("ADMIN_FIRESTORE_NOT_READY");
  }

  console.log("[backfill] rebuilding public tournament list aggregate...");
  await rebuildPublicTournamentListAggregate(adminDb);

  console.log("[backfill] rebuilding public player rankings aggregate...");
  await rebuildPlayerRankingsAggregate(adminDb);

  const tournamentsSnap = await adminDb.collection("tournaments").get();
  const profileKeys = new Map<string, { shortId?: string; name?: string }>();

  console.log(`[backfill] tournaments: ${tournamentsSnap.size}`);

  for (const tournamentDoc of tournamentsSnap.docs) {
    const tournamentId = tournamentDoc.id;
    console.log(`[backfill] tournament ${tournamentId}: public detail`);
    await rebuildPublicTournamentAggregate(adminDb, tournamentId);

    console.log(`[backfill] tournament ${tournamentId}: overall(all)`);
    await rebuildOverallAggregate(adminDb, tournamentId);

    const playersSnap = await tournamentDoc.ref.collection("players").get();
    for (const playerDoc of playersSnap.docs) {
      const playerData = playerDoc.data();
      const shortId = typeof playerData.shortId === "string" && playerData.shortId ? playerData.shortId : undefined;
      const name = typeof playerData.name === "string" && playerData.name ? playerData.name : undefined;
      const key = shortId ? `sid:${shortId}` : name ? `name:${name}` : "";
      if (key && !profileKeys.has(key)) {
        profileKeys.set(key, { shortId, name });
      }
    }

    const divisionsSnap = await tournamentDoc.ref.collection("divisions").get();
    console.log(`[backfill] tournament ${tournamentId}: divisions ${divisionsSnap.size}`);

    for (const divisionDoc of divisionsSnap.docs) {
      const divisionId = divisionDoc.id;
      console.log(`[backfill] tournament ${tournamentId} / division ${divisionId}: overall`);
      await rebuildOverallAggregate(adminDb, tournamentId, divisionId);

      const eventsSnap = await divisionDoc.ref.collection("events").get();
      console.log(`[backfill] tournament ${tournamentId} / division ${divisionId}: events ${eventsSnap.size}`);

      for (const eventDoc of eventsSnap.docs) {
        console.log(`[backfill] tournament ${tournamentId} / division ${divisionId} / event ${eventDoc.id}: scoreboard`);
        await rebuildEventScoreboardAggregate(adminDb, tournamentId, divisionId, eventDoc.id);
      }
    }
  }

  console.log(`[backfill] player profiles: ${profileKeys.size}`);
  for (const identity of profileKeys.values()) {
    console.log(`[backfill] player profile ${identity.shortId ?? identity.name}`);
    await rebuildPlayerProfileAggregate(adminDb, identity.shortId, identity.name);
  }

  console.log("[backfill] done");
}

main().catch((error) => {
  console.error("[backfill] failed", error);
  process.exitCode = 1;
});
