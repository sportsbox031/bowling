import assert from "node:assert/strict";
import { createLoadedScoreboardSections, markSectionLoaded, needsSectionLoad } from "../src/lib/admin-scoreboard-sections.ts";

const initial = createLoadedScoreboardSections();
assert.equal(needsSectionLoad(initial, "setup"), true, "fresh setup section should require loading");
assert.equal(needsSectionLoad(initial, "scores"), true, "fresh scores section should require loading");
assert.equal(needsSectionLoad(initial, "teams"), true, "fresh teams section should require loading");

const afterSetup = markSectionLoaded(initial, "setup");
assert.equal(needsSectionLoad(afterSetup, "setup"), false, "loaded setup section should not require loading");
assert.equal(needsSectionLoad(afterSetup, "scores"), true, "loading setup must not affect scores");
assert.equal(needsSectionLoad(afterSetup, "teams"), true, "loading setup must not affect teams");

const afterScores = markSectionLoaded(afterSetup, "scores");
assert.equal(needsSectionLoad(afterScores, "scores"), false, "loaded scores section should not require loading");
assert.equal(needsSectionLoad(afterScores, "teams"), true, "loading scores must not affect teams");

console.log("admin scoreboard sections test passed");
