# Bowling Admin/Public Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate repeated UI and admin logic, add CSV/TSV/XLSX player bulk import, improve admin score-entry UX with draft recovery and keyboard navigation, and add print-friendly public result views without regressing existing flows.

**Architecture:** Preserve current routes and fetch/save behavior, then add shared presentation primitives and shared player/admin helpers around them. New import, draft, and print features stay additive so existing tournament workflows remain the source of truth.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Firebase client/admin SDK, browser localStorage, print CSS.

---

### Task 1: Restore type-safe baseline

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`
- Modify: `src/app/tournaments/[tournamentId]/events/[eventId]/lanes/page.tsx`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/players/import/route.ts`

**Step 1: Write the failing check**

Run: `npx tsc --noEmit`
Expected: FAIL with unresolved draft state, print-mode state, and import typing errors.

**Step 2: Fix the missing state and helper declarations**

- Reintroduce the score draft state declarations used by the restored effects.
- Remove local constants that conflict with shared imports.
- Add print-mode state to the lane sheet page.
- Narrow bulk-import route payloads so shared player helpers receive validated values.

**Step 3: Run the check again**

Run: `npx tsc --noEmit`
Expected: PASS or reveal only the next concrete type issue.

### Task 2: Finish shared UI consolidation on public pages

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/players/page.tsx`
- Modify: `src/app/tournaments/[tournamentId]/page.tsx`
- Modify: `src/app/tournaments/[tournamentId]/events/[eventId]/page.tsx`
- Modify: `src/app/tournaments/[tournamentId]/overall/page.tsx`
- Modify: `src/app/tournaments/[tournamentId]/events/[eventId]/lanes/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/GlassInput.tsx`
- Modify: `src/components/ui/GlassSelect.tsx`
- Create/confirm: `src/components/common/PageTitle.tsx`
- Create/confirm: `src/components/common/SearchField.tsx`
- Create/confirm: `src/components/common/StatusBanner.tsx`
- Create/confirm: `src/components/common/PrintModeBar.tsx`
- Create/confirm: `src/components/scoreboard/RankingTable.tsx`
- Create/confirm: `src/lib/constants.ts`

**Step 1: Reuse shared headers, search, status, labels, and ranking tables**

- Replace repeated inline title and search blocks.
- Replace repeated rank-color logic with shared rank styling.
- Reuse shared labels for event kind and gender where possible.

**Step 2: Finish print-mode support**

- Add the shared print toggle to event, overall, and lane pages.
- Ensure print CSS hides decorative controls and backgrounds.

**Step 3: Verify behavior**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 3: Consolidate admin player logic and tournament-admin messaging

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/page.tsx`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/players/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/players/[playerId]/route.ts`
- Create/confirm: `src/lib/admin/players.ts`
- Create/confirm: `src/components/admin/PlayerBulkImportPanel.tsx`

**Step 1: Remove duplicated player normalization and validation logic**

- Route handlers should share normalization, validation, number assignment, and document-building helpers.
- Tournament admin page should reuse the shared status banner and keep existing forms intact.

**Step 2: Integrate the bulk import panel into player management**

- Mount it only when a division is selected.
- Keep manual add/edit/delete flows available.

**Step 3: Verify behavior**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 4: Add CSV/TSV/XLSX player import with preview and dedupe

**Files:**
- Modify: `src/components/admin/PlayerBulkImportPanel.tsx`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/players/import/route.ts`
- Modify: `package.json`

**Step 1: Add XLSX parsing support**

- Install a minimal Excel parsing dependency if one is not already present.
- Parse CSV/TSV locally with delimiter detection.
- Parse XLSX into the same row shape.

**Step 2: Keep preview and validation before import**

- Surface invalid rows clearly.
- Send only normalized rows to the import API.
- Preserve dedupe behavior on the server.

**Step 3: Verify behavior**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 5: Add score-entry draft recovery and keyboard-first movement

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`
- Create/confirm: `src/lib/score-draft.ts`

**Step 1: Wire local draft persistence to the existing score-entry state**

- Persist score inputs by tournament/division/event/game/lane context.
- Restore draft values when the same context is reopened.
- Clear drafts after successful save or explicit reset.

**Step 2: Add keyboard navigation**

- Track score input refs by row and game.
- Support Enter/ArrowUp/ArrowDown movement without changing score semantics.
- Auto-focus the first active score input when appropriate.

**Step 3: Verify behavior**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 6: Final verification

**Files:**
- No code changes unless a verification failure reveals one.

**Step 1: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 2: Run app build if sandbox permits**

Run: `npm run build`
Expected: PASS or a documented sandbox-only process limitation.

**Step 3: Summarize any residual runtime checks**

- Confirm which flows were verified statically.
- Call out any checks that still need browser/manual validation.
