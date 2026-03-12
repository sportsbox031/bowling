import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const createSource = readFileSync(
  join(
    process.cwd(),
    "src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/route.ts",
  ),
  "utf8",
);
const updateSource = readFileSync(
  join(
    process.cwd(),
    "src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/[teamId]/route.ts",
  ),
  "utf8",
);

assert.equal(
  createSource.includes("hydrateMissingTeamMemberships"),
  true,
  "team creation should use team membership index lookup",
);
assert.equal(
  createSource.includes("const existingSnap = await ref.get();"),
  false,
  "team creation should not read the full teams collection for duplicate checks",
);
assert.equal(
  updateSource.includes("hydrateMissingTeamMemberships"),
  true,
  "team updates should use team membership index lookup",
);
assert.equal(
  updateSource.includes("const allTeamsSnap = await teamsRef.get();"),
  false,
  "team updates should not read the full teams collection for duplicate checks",
);
assert.equal(
  updateSource.includes("deleteTeamMemberships(batch"),
  true,
  "team updates should keep membership index in sync",
);

console.log("team membership index test passed");
