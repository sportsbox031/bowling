import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/lib/aggregates/player-profile.ts"), "utf8");
assert.equal(source.includes('const FIRESTORE_IN_QUERY_LIMIT = 10;'), true);
assert.equal(source.includes('chunkStrings(uniqueDivisionIds, FIRESTORE_IN_QUERY_LIMIT)'), true);
assert.equal(source.includes('playersRef.where("divisionId", "in", divisionChunk).get()'), true);

console.log("player profile division chunking test passed");
