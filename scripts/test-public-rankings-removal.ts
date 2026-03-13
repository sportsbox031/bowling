import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const headerSource = readFileSync(join(process.cwd(), "src/components/PublicHeader.tsx"), "utf8");
const pageSource = readFileSync(join(process.cwd(), "src/app/players/page.tsx"), "utf8");
const routeSource = readFileSync(join(process.cwd(), "src/app/api/public/players/rankings/route.ts"), "utf8");

assert.equal(headerSource.includes('/players'), false);
assert.equal(pageSource.includes("notFound()"), true);
assert.equal(routeSource.includes('status: 404'), true);

console.log("public rankings removal test passed");
