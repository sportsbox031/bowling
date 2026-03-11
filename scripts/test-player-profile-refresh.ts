import assert from "node:assert/strict";
import { buildPlayerProfileRefreshTargets } from "../src/lib/player-profile-refresh.ts";

const targets = buildPlayerProfileRefreshTargets([
  { shortId: "P0001", name: "김철수" },
  { shortId: "P0001", name: "김철수" },
  { name: "이영희" },
  { name: "이영희" },
  { shortId: "P0002", name: "박민수" },
  { shortId: " ", name: "  " },
]);

assert.deepEqual(targets, [
  { shortId: "P0001", name: "김철수" },
  { name: "이영희" },
  { shortId: "P0002", name: "박민수" },
]);

console.log("player profile refresh target test passed");
