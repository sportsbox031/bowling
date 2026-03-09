# Participant Range Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admin event participant registration to accept a single player number or a numeric range like `1-30` and register valid players into the selected squad with a summary result.

**Architecture:** Keep the existing participant registration API and single-number workflow intact. Add a small pure parser/helper for number range input, verify it with a one-off test script, then route the existing Enter-key handler through the shared helper so range registration reuses the current per-player add flow and message handling.

**Tech Stack:** Next.js App Router, React 18, TypeScript, browser event handlers, one-off Node test script.

---

### Task 1: Add and verify range parsing helper

**Files:**
- Create: `src/lib/participant-range.ts`
- Create: `scripts/participant-range.test.ts`

**Step 1: Write the failing test**
- Cover `15` -> `[15]`
- Cover `1-3` -> `[1,2,3]`
- Cover invalid input like `a-b` and reversed ranges

**Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types scripts/participant-range.test.ts`
Expected: FAIL because helper does not exist yet.

**Step 3: Write minimal implementation**
- Return parsed numbers for single and range input
- Return `null` for unsupported formats

**Step 4: Run test to verify it passes**
Run: `node --experimental-strip-types scripts/participant-range.test.ts`
Expected: PASS

### Task 2: Reuse helper in scoreboard participant input

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

**Step 1: Replace the inline single-number Enter handler**
- Parse the input as single or range
- Reuse existing `handleAddParticipant` per player
- Skip missing or already-registered players
- Summarize counts after processing

**Step 2: Keep current squad behavior unchanged**
- Use the currently selected squad when squads are enabled
- Clear the input only after processing succeeds

**Step 3: Run verification**
Run: `npx tsc --noEmit`
Expected: PASS

### Task 3: Final verification

**Files:**
- No code changes unless verification fails

**Step 1: Re-run the helper test**
Run: `node --experimental-strip-types scripts/participant-range.test.ts`
Expected: PASS

**Step 2: Run TypeScript verification**
Run: `npx tsc --noEmit`
Expected: PASS
