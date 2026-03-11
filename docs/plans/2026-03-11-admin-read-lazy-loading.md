# Admin Read Lazy Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce Firestore reads in the admin scoreboard by lazily loading expensive data sections and reusing already-fetched client state.

**Architecture:** Keep one lightweight setup fetch for event configuration and lane-management data, then lazily fetch score aggregates and team data on demand. Track loaded sections in client state so tab revisits stay local, and reload only stale sections after mutations.

**Tech Stack:** Next.js app router, React client state, Firestore-backed route handlers, TypeScript.

---

### Task 1: Add section-loading state helper

**Files:**
- Create: `src/lib/admin-scoreboard-sections.ts`
- Test: `scripts/test-admin-scoreboard-sections.ts`

### Task 2: Split heavy admin bundle usage

**Files:**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/bundle/route.ts`
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

### Task 3: Prefer local state after admin writes

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

### Task 4: Verify end to end

**Files:**
- Test: `scripts/test-admin-scoreboard-sections.ts`
