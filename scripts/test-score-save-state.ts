import assert from "node:assert/strict";
import { applySavedDraftEntries } from "../src/lib/score-save-state.ts";

const dirty = new Set(["p1", "p2", "p3"]);
const result = applySavedDraftEntries(dirty, ["p2"]);

assert.deepEqual([...result].sort(), ["p1", "p3"], "single player save should remove that player from dirty draft state");

console.log("score save state test passed");
