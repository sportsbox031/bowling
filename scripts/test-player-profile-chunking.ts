import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/lib/aggregates/player-profile.ts"), "utf8");
assert.equal(source.includes('db.collectionGroup("players").where("shortId", "==", shortId).get()'), true);
assert.equal(source.includes('db.collectionGroup("players").where("name", "==", name).get()'), true);
assert.equal(source.includes("readEventScoreboardAggregate"), true);
assert.equal(source.includes("rebuildEventScoreboardAggregate"), true);
assert.equal(source.includes('eventDoc.ref.collection("scores").get()'), false);

console.log("player profile aggregate reuse test passed");
