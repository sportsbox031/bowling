import assert from "node:assert/strict";
import { adminManualSections, adminQuickStart } from "../src/lib/admin-operator-manual.ts";

assert.equal(adminQuickStart.length >= 5, true, "quick start should have at least five steps");
assert.equal(adminManualSections.length >= 4, true, "manual should expose the core operating sections");
assert.equal(adminManualSections.some((section) => section.id === "score"), true, "manual should include score input guidance");
assert.equal(adminManualSections.every((section) => section.steps.length >= 3), true, "every section should have at least three actionable steps");

console.log("admin operator manual test passed");
