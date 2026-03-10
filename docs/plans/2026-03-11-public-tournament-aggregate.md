# Public Tournament Aggregate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a cached public tournament detail aggregate so the public detail API stops re-reading divisions and events on every request.

**Architecture:** Build a per-tournament aggregate document under the tournament subtree, switch the public detail API to read it first, and rebuild it from admin tournament/division/event write APIs. Keep the public response shape unchanged.

**Tech Stack:** Next.js App Router, Firebase Admin SDK, TypeScript, Node strip-types scripts

---

### Task 1: Add failing aggregate payload test

**Files:**
- Create: `scripts/public-tournament-aggregate.test.ts`

**Step 1: Write the failing test**
Create a node script that imports `buildPublicTournamentAggregatePayload` from `src/lib/aggregates/public-tournament.ts` and asserts division and event ordering.

**Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types scripts/public-tournament-aggregate.test.ts`
Expected: FAIL with module not found because the aggregate module does not exist yet.

### Task 2: Implement the public tournament aggregate module

**Files:**
- Create: `src/lib/aggregates/public-tournament.ts`

**Step 1: Write minimal implementation**
Add payload types, a builder function, read/rebuild helpers, and a delete helper for `tournaments/{tournamentId}/aggregates/public-detail`.

**Step 2: Run test to verify it passes**
Run: `node --experimental-strip-types scripts/public-tournament-aggregate.test.ts`
Expected: PASS

### Task 3: Switch the public detail API

**Files:**
- Modify: `src/app/api/public/tournaments/[tournamentId]/route.ts`

**Step 1: Read aggregate first**
Use memory cache, then aggregate doc, then rebuild fallback. Keep response shape identical.

**Step 2: Add dynamic route guard if needed**
Ensure the API is not statically pre-read during build if that becomes necessary.

### Task 4: Rebuild aggregate on admin writes

**Files:**
- Modify: `src/app/api/admin/tournaments/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/route.ts`

**Step 1: Hook aggregate rebuilds**
After successful create or update, rebuild the public tournament aggregate.

**Step 2: Handle delete flow**
After division or event delete, rebuild the aggregate. After tournament delete, delete the aggregate doc.

**Step 3: Invalidate memory caches**
Invalidate `pub-tournament:${tournamentId}` and tournament list cache keys where tournament metadata changes.

### Task 5: Include aggregate in backfill and verify

**Files:**
- Modify: `scripts/backfill-aggregates.ts`

**Step 1: Rebuild public tournament aggregates during backfill**
Run one rebuild per tournament.

**Step 2: Verify build**
Run: `npm run build`
Expected: successful production build.
