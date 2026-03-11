import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/components/PlayerProfileModal.tsx"), "utf8");
assert.equal(source.includes('alignItems: "flex-start"'), true);
assert.equal(source.includes('overflowY: "auto"'), true);
assert.equal(source.includes('maxHeight: "calc(100vh - 32px)"'), true);
assert.equal(source.includes('margin: "0 auto"'), true);

console.log("player profile modal layout test passed");
