import assert from "node:assert/strict";
import { isAggregateFresh } from "../src/lib/aggregates/freshness.ts";

const now = new Date("2026-03-11T09:00:00.000Z").getTime();

assert.equal(isAggregateFresh("2026-03-11T08:59:00.000Z", 5 * 60 * 1000, now), true);
assert.equal(isAggregateFresh("2026-03-11T08:40:00.000Z", 5 * 60 * 1000, now), false);
assert.equal(isAggregateFresh(undefined, 5 * 60 * 1000, now), false);
assert.equal(isAggregateFresh("bad-date", 5 * 60 * 1000, now), false);

console.log("aggregate freshness test passed");
