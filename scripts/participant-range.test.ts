import assert from "node:assert/strict";
import { parseParticipantNumberInput } from "../src/lib/participant-range.ts";

assert.deepEqual(parseParticipantNumberInput("15"), [15]);
assert.deepEqual(parseParticipantNumberInput("1-3"), [1, 2, 3]);
assert.equal(parseParticipantNumberInput("3-1"), null);
assert.equal(parseParticipantNumberInput("a-b"), null);
assert.equal(parseParticipantNumberInput("1-3-5"), null);

console.log("participant-range tests passed");
