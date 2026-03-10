# Read Quota Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cut remaining high-frequency Firestore reads by switching the public tournament detail page to aggregates and throttling expensive score-save aggregate rebuilds.

**Architecture:** Reuse the existing public tournament aggregate for the server-rendered detail page, and add a tiny aggregate freshness helper so score-save can skip rebuilding rankings/profile aggregates when a fresh aggregate already exists.

**Tech Stack:** Next.js App Router, Firebase Admin SDK, TypeScript, Node strip-types scripts

---

### Task 1: Add failing freshness helper test

**Files:**
- Create: `scripts/aggregate-freshness.test.ts`

**Step 1: Write the failing test**
Assert that a helper reports `fresh` for recent timestamps and `stale` for old timestamps.

**Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types scripts/aggregate-freshness.test.ts`
Expected: FAIL with module not found or missing export.

### Task 2: Implement freshness helper

**Files:**
- Create: `src/lib/aggregates/freshness.ts`

**Step 1: Write minimal implementation**
Export a helper that checks whether `updatedAt` is within a given max age.

**Step 2: Re-run test**
Run: `node --experimental-strip-types scripts/aggregate-freshness.test.ts`
Expected: PASS

### Task 3: Reduce score-save rebuild frequency

**Files:**
- Modify: `src/app/api/admin/score/route.ts`

**Step 1: Keep live aggregates immediate**
Continue rebuilding event scoreboard and overall aggregates on every score save.

**Step 2: Throttle expensive global aggregates**
Only rebuild player rankings and player profile when their existing aggregate is stale.

### Task 4: Switch public tournament detail page to aggregate reads

**Files:**
- Modify: `src/app/tournaments/[tournamentId]/page.tsx`

**Step 1: Read aggregate directly**
Use the existing public tournament aggregate with rebuild fallback.

**Step 2: Preserve UI output**
Keep the rendered structure and links the same.

### Task 5: Verify

**Files:**
- Test: `scripts/aggregate-freshness.test.ts`

**Step 1: Run helper test**
Run: `node --experimental-strip-types scripts/aggregate-freshness.test.ts`
Expected: PASS

**Step 2: Run production build**
Run: `npm run build`
Expected: successful production build
