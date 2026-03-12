import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(
    process.cwd(),
    "src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/rank-refresh/route.ts",
  ),
  "utf8",
);

assert.equal(
  source.includes("markOverallAggregateStale(adminDb, tournamentId)"),
  true,
  "rank refresh should mark tournament overall aggregate stale instead of rebuilding it immediately",
);
assert.equal(
  source.includes("markPlayerRankingsAggregateStale(adminDb)"),
  true,
  "rank refresh should defer player rankings rebuild",
);
assert.equal(
  source.includes("markPlayerProfileAggregateStale(adminDb, target.shortId, target.name)"),
  true,
  "rank refresh should defer per-player profile rebuilds",
);
assert.equal(
  source.includes("rebuildPlayerRankingsAggregate(adminDb)"),
  false,
  "rank refresh should not trigger a full player rankings rebuild",
);
assert.equal(
  source.includes("rebuildPlayerProfileAggregate(adminDb, target.shortId, target.name)"),
  false,
  "rank refresh should not rebuild every player profile inline",
);
assert.equal(
  source.includes("rebuildOverallAggregate(adminDb, tournamentId),"),
  false,
  "rank refresh should not rebuild tournament-wide overall aggregate inline",
);

console.log("rank refresh deferred aggregate test passed");
