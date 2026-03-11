import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const files = [
  "src/app/tournaments/[tournamentId]/events/[eventId]/page.tsx",
  "src/app/tournaments/[tournamentId]/events/[eventId]/lanes/page.tsx",
  "src/app/tournaments/[tournamentId]/overall/page.tsx",
];

for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  assert.equal(source.includes("PrintModeBar"), false, `${file} should not import or render PrintModeBar`);
  assert.equal(source.includes("printMode"), false, `${file} should not keep printMode state`);
}

console.log("print mode toggle removed from public pages");
