import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sectionsSource = readFileSync(
  join(process.cwd(), "src/lib/admin-scoreboard-sections.ts"),
  "utf8",
);
const bundleSource = readFileSync(
  join(
    process.cwd(),
    "src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/bundle/route.ts",
  ),
  "utf8",
);
const pageSource = readFileSync(
  join(
    process.cwd(),
    "src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx",
  ),
  "utf8",
);

assert.equal(
  sectionsSource.includes('"setup" | "assignments" | "scores" | "teams"'),
  true,
  "scoreboard sections should track assignments separately",
);
assert.equal(
  bundleSource.includes("assignments: sortAssignmentsByPosition"),
  false,
  "setup bundle should not include assignments payload anymore",
);
assert.equal(
  pageSource.includes('markSectionLoaded(prev, "assignments")'),
  true,
  "scoreboard page should mark assignments section loaded after fetching it",
);
assert.equal(
  pageSource.includes('if (activeTab !== "lane" && activeTab !== "score") return;'),
  true,
  "scoreboard page should only lazy-load assignments for lane and score tabs",
);

console.log("scoreboard assignment lazy-load test passed");
