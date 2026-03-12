import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/lib/firebase/eventPath.ts"), "utf8");

const aggregateLookupIndex = source.indexOf("readPublicTournamentAggregate(db, tournamentId)");
const fallbackScanIndex = source.indexOf('collection("divisions").get()');

assert.equal(
  aggregateLookupIndex >= 0,
  true,
  "resolveEventRef should consult the public tournament aggregate before scanning divisions",
);
assert.equal(
  fallbackScanIndex >= 0,
  true,
  "resolveEventRef should keep a fallback division scan when aggregate lookup is unavailable",
);
assert.equal(
  aggregateLookupIndex < fallbackScanIndex,
  true,
  "aggregate lookup should happen before fallback division scanning",
);

console.log("event path aggregate lookup test passed");
