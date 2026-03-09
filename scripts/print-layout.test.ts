import assert from "node:assert/strict";
import { chunkItems } from "../src/lib/print-layout.ts";

assert.deepEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepEqual(chunkItems([1, 2, 3], 5), [[1, 2, 3]]);
assert.deepEqual(chunkItems([], 3), []);
assert.deepEqual(chunkItems([1, 2], 0), [[1, 2]]);

console.log("print-layout tests passed");
