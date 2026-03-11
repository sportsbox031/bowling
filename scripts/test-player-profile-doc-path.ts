import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/lib/aggregates/player-profile.ts"), "utf8");
assert.equal(source.includes('export const PLAYER_PROFILE_COLLECTION_PATH = "playerProfiles";'), true);
assert.equal(source.includes('db.collection(PLAYER_PROFILE_COLLECTION_PATH).doc(buildProfileDocId(shortId, name));'), true);
assert.equal(source.includes('aggregates/playerProfiles/'), false);

console.log("player profile doc path test passed");
