# Participant Removal And Print Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add confirmed participant unregister flow with immediate filtered-list updates, and create print-only paginated layouts for public event scoreboards and lane sheets.

**Architecture:** Keep live screen UI unchanged for browsing and interaction. Add small pure helpers for page chunking, verify them with one-off tests, then render dedicated print-only sections that are visible only during printing.

**Tech Stack:** Next.js App Router, React 18, TypeScript, browser print CSS, one-off Node test script.

---

### Task 1: Add and verify print chunking helpers

**Files:**
- Create: `src/lib/print-layout.ts`
- Create: `scripts/print-layout.test.ts`

**Step 1: Write the failing test**
- Verify row chunking creates stable page groups.
- Verify lane grouping creates page batches.

**Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types .\scripts\print-layout.test.ts`
Expected: FAIL because helper is missing.

**Step 3: Write minimal implementation**
- Add generic chunk helper.
- Add lane page grouping helper if needed.

**Step 4: Run test to verify it passes**
Run: `node --experimental-strip-types .\scripts\print-layout.test.ts`
Expected: PASS

### Task 2: Fix participant unregister UX

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

**Step 1: Add confirmation before unregistering**
- Prompt with the player name.
- Cancel cleanly without side effects.

**Step 2: Keep filtered view in sync**
- Remove from `participantList` state immediately after successful API response.
- Ensure current squad-view filter reflects the removal without extra clicks.

**Step 3: Verify**
Run: `npx tsc --noEmit`
Expected: PASS

### Task 3: Build print-only paginated score layout

**Files:**
- Modify: `src/app/tournaments/[tournamentId]/events/[eventId]/page.tsx`
- Modify: `src/app/globals.css`
- Reuse: `src/lib/print-layout.ts`

**Step 1: Hide interactive screen-only sections in print**
- Keep navigation, search, and helper cards off the print output.

**Step 2: Render print-only page groups**
- Split score rows into page-sized groups.
- Repeat headings per printed page.

**Step 3: Verify**
Run: `npx tsc --noEmit`
Expected: PASS

### Task 4: Build print-only paginated lane layout

**Files:**
- Modify: `src/app/tournaments/[tournamentId]/events/[eventId]/lanes/page.tsx`
- Modify: `src/app/globals.css`
- Reuse: `src/lib/print-layout.ts`

**Step 1: Hide interactive lane UI in print**
- Keep squad tabs, search, and rule cards off the printed output.

**Step 2: Render lane groups per print page**
- Batch lane blocks so each page starts with actual lane content.
- Prevent lane blocks from splitting across pages.

**Step 3: Verify**
Run: `npx tsc --noEmit`
Expected: PASS
