# Participant Tab Squad Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `전체`-default squad view filter only to the participant registration tab without changing the existing squad selection behavior used by registration, lane assignment, and score entry.

**Architecture:** Introduce a participant-tab-specific filter state separate from the existing `selectedSquadId`. Use that state only when rendering the participant list and its squad selector, while preserving all current add/remove and assignment flows.

**Tech Stack:** Next.js App Router, React 18, TypeScript.

---

### Task 1: Add participant-tab-only squad view state

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

**Step 1: Add a dedicated view filter state**
- Default it to `ALL`
- Reset safely when squads change

**Step 2: Filter only the participant tab list**
- `전체` shows all players as today
- A squad button shows only players registered in that squad

**Step 3: Keep existing selected squad behavior intact**
- Number/range registration still targets the currently selected squad
- Lane/score tabs still use the current squad selector

**Step 4: Verify**
Run: `npx tsc --noEmit`
Expected: PASS
