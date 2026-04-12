# Fives Single Event Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert 5-player competition handling from two linked events (`FIRST`/`SECOND`) into one `FIVES` event with separate first-half and second-half lineups while preserving existing scoring, assignments, ranking, and print workflows.

**Architecture:** Keep one Firestore event for 5-player competition and move half-specific behavior into team-level lineup data plus event-level phase metadata. Replace cross-event linking and aggregate stitching with a single-event scoring pipeline that computes team totals by half-aware active lineups. Migrate UI in phases so reads can support both legacy and new shapes before writes switch fully.

**Tech Stack:** Next.js app router, TypeScript, Firebase Admin/Firestore, Jest, existing admin/public aggregate cache layer

---

## File Structure

**Core models and helpers**
- Modify: `src/lib/models.ts`
- Create: `src/lib/fives-config.ts`
- Create: `src/lib/fives-lineup.ts`
- Modify: `src/lib/firebase/schema.ts`
- Modify: `src/lib/team-identity.ts`
- Deprecate later: `src/lib/fives-link.ts`

**Admin event setup**
- Modify: `src/app/admin/tournaments/[tournamentId]/page.tsx`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/route.ts`
- Delete after cutover: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/copy-from/[sourceEventId]/route.ts`

**Teams and lineup editing**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/[teamId]/route.ts`
- Modify: `src/lib/admin/team-membership.ts`
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

**Assignments and score entry**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/assignments/route.ts`
- Modify: `src/lib/aggregates/event-assignments.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/bundle/route.ts`
- Modify: `src/app/api/admin/score/route.ts`

**Ranking and summary**
- Modify: `src/lib/scoring.ts`
- Modify: `src/lib/aggregates/event-scoreboard.ts`
- Modify: `src/lib/aggregates/overall.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/rank-refresh/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/summary/route.ts`
- Modify: `src/components/scoreboard/RankingTable.tsx`
- Modify: `src/app/api/public/scoreboard/route.ts`

**Print and presentation**
- Modify: `src/app/admin/tournaments/[tournamentId]/prints/scores/page.tsx`
- Modify: `src/app/admin/tournaments/[tournamentId]/prints/lanes/page.tsx`
- Modify: `src/app/admin/tournaments/[tournamentId]/summary/page.tsx`
- Modify: `src/app/admin/tournaments/[tournamentId]/certificates/page.tsx`

**Migration and tests**
- Create: `scripts/migrate-fives-to-single-event.ts`
- Create: `src/lib/__tests__/fives-config.test.ts`
- Modify: `src/lib/__tests__/scoring.test.ts`
- Create: `src/lib/__tests__/fives-lineup.test.ts`
- Extend or create: aggregate route tests for summary/public scoreboard

---

## Chunk 1: New Data Model and Compatibility Layer

### Task 1: Define single-event 5-player metadata

**Files:**
- Modify: `src/lib/models.ts`
- Create: `src/lib/fives-config.ts`
- Test: `src/lib/__tests__/fives-config.test.ts`

- [ ] **Step 1: Write failing tests for phase split and lineup helpers**
- [ ] **Step 2: Add `fivesConfig` model fields**
  - `phaseSplitGameCount`
  - `lineupMode` or explicit `firstHalfGameCount`/`secondHalfGameCount`
  - optional legacy compatibility fields retained temporarily
- [ ] **Step 3: Add helper functions**
  - `isFivesEvent`
  - `getFirstHalfGameNumbers`
  - `getSecondHalfGameNumbers`
  - `getHalfForGameNumber`
- [ ] **Step 4: Run focused tests**
  - Run: `npm test -- --runInBand src/lib/__tests__/fives-config.test.ts`
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add single-event fives config helpers"`

### Task 2: Define team lineup shape for first/second half

**Files:**
- Modify: `src/lib/models.ts`
- Create: `src/lib/fives-lineup.ts`
- Test: `src/lib/__tests__/fives-lineup.test.ts`

- [ ] **Step 1: Write failing tests for lineup validation**
- [ ] **Step 2: Add team fields**
  - keep `rosterIds`
  - add `firstHalfMemberIds`
  - add `secondHalfMemberIds`
  - keep `memberIds` temporarily as compatibility alias for UI migration
- [ ] **Step 3: Add lineup helper functions**
  - validate lineup size against team size
  - derive active lineup for a specific game number
  - derive bench players by half
- [ ] **Step 4: Run focused tests**
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add fives half lineup model"`

---

## Chunk 2: Event Creation and Admin Setup Migration

### Task 3: Replace FIRST/SECOND event creation UX with single-event setup

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/page.tsx`
- Modify: `src/lib/fives-link.ts`

- [ ] **Step 1: Write/update UI tests or component-level assertions if present**
- [ ] **Step 2: Remove event form inputs for `halfType` and `linkedEventId`**
- [ ] **Step 3: Add form inputs for 5-player phase split**
  - 4 games => 2/2
  - 6 games => 3/3
  - if odd or unsupported counts are currently allowed, define explicit validation behavior
- [ ] **Step 4: Replace `buildFivesEventPayload` with single-event payload helper**
- [ ] **Step 5: Remove copy-from confirmation flow**
- [ ] **Step 6: Smoke test admin event creation manually**
- [ ] **Step 7: Commit**
  - `git commit -m "refactor: create fives as a single event"`

### Task 4: Update event create/update APIs

**Files:**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/route.ts`
- Delete later: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/copy-from/[sourceEventId]/route.ts`

- [ ] **Step 1: Add failing tests for new event payload validation if route tests exist**
- [ ] **Step 2: Accept and persist `fivesConfig` fields**
- [ ] **Step 3: Stop writing `linkedEventId` and `halfType` for new data**
- [ ] **Step 4: Keep GET responses backward-compatible during migration**
- [ ] **Step 5: Mark copy-from route as legacy or remove once no callers remain**
- [ ] **Step 6: Verify create/edit flows manually**
- [ ] **Step 7: Commit**
  - `git commit -m "feat: store fives single-event metadata"`

---

## Chunk 3: Team and Lineup Editing

### Task 5: Make team documents half-aware

**Files:**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/[teamId]/route.ts`
- Modify: `src/lib/admin/team-membership.ts`

- [ ] **Step 1: Write failing tests for team creation/update with half lineups**
- [ ] **Step 2: On 5-player team creation, initialize**
  - `rosterIds`
  - `firstHalfMemberIds`
  - `secondHalfMemberIds` initially same as first half unless user edits later
- [ ] **Step 3: Redefine membership indexing**
  - membership means “belongs to team roster”, not “currently active”
- [ ] **Step 4: Remove dependency on `linkedTeamId`**
- [ ] **Step 5: Preserve existing doubles/triples behavior unchanged**
- [ ] **Step 6: Run focused API tests**
- [ ] **Step 7: Commit**
  - `git commit -m "refactor: store fives roster and half lineups"`

### Task 6: Redesign scoreboard team editor for first/second half lineups

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

- [ ] **Step 1: Write failing tests where practical or add a manual QA checklist section in the plan**
- [ ] **Step 2: Replace “current roster edit” with explicit sections**
  - team roster (6~7명)
  - first-half lineup (5명)
  - second-half lineup (5명)
- [ ] **Step 3: Show bench players per half**
- [ ] **Step 4: Keep make-up team flow valid for leftover roster moves**
- [ ] **Step 5: Remove UI assumptions that editing roster means switching entire event active five**
- [ ] **Step 6: Manual QA**
  - create team
  - change second-half lineup
  - ensure bench player still appears in score entry but not team total
- [ ] **Step 7: Commit**
  - `git commit -m "feat: edit fives half lineups in scoreboard"`

---

## Chunk 4: Assignment Pipeline

### Task 7: Make assignments phase-aware inside one event

**Files:**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/assignments/route.ts`
- Modify: `src/lib/aggregates/event-assignments.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/bundle/route.ts`

- [ ] **Step 1: Write failing tests for 5-player assignment generation with distinct second-half lineup**
- [ ] **Step 2: For random/manual assignment generation**
  - first-half games use first-half lineup active players
  - second-half games use second-half lineup active players
  - bench players can still receive lane assignments only if individual recording is required by current UX
- [ ] **Step 3: Decide and document bench-lane policy**
  - if bench scores are recorded in another lane, assignments API must support them explicitly
  - if not assigned, score entry workflow must have another capture path
- [ ] **Step 4: Include enough event metadata in assignments aggregate for half-aware rendering**
- [ ] **Step 5: Verify scoreboard lane board still renders correctly**
- [ ] **Step 6: Commit**
  - `git commit -m "feat: support half-aware fives assignments"`

---

## Chunk 5: Scoring and Aggregate Rewrite

### Task 8: Replace cross-event fives aggregation with single-event half-aware scoring

**Files:**
- Modify: `src/lib/scoring.ts`
- Modify: `src/lib/aggregates/event-scoreboard.ts`
- Modify: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing tests for these cases**
  - player plays first half only => first-half scores count only
  - player plays second half only => second-half scores count only
  - player plays both halves => both halves count
  - benched player’s second-half score does not count unless active in second-half lineup
- [ ] **Step 2: Add a new single-event fives team leaderboard builder**
- [ ] **Step 3: Remove `buildFivesLinkedLeaderboard` usage from aggregates**
- [ ] **Step 4: Compute one team leaderboard directly from one event’s scores + lineup metadata**
- [ ] **Step 5: Keep public/team rows shape stable where possible**
- [ ] **Step 6: Run focused scoring tests**
- [ ] **Step 7: Commit**
  - `git commit -m "refactor: compute fives totals from half-aware lineups"`

### Task 9: Update score save and rank refresh flows

**Files:**
- Modify: `src/app/api/admin/score/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/rank-refresh/route.ts`

- [ ] **Step 1: Write failing tests or reproducible script for score save + refresh**
- [ ] **Step 2: Remove linked-event rebuild logic for 5-player scoring**
- [ ] **Step 3: Rebuild only current event aggregate and division overall aggregate**
- [ ] **Step 4: Verify score refresh reflects saved values immediately**
- [ ] **Step 5: Verify rank refresh no longer depends on legacy linked event fields**
- [ ] **Step 6: Commit**
  - `git commit -m "refactor: simplify fives rank refresh for single-event model"`

---

## Chunk 6: Overall, Summary, Public Scoreboard, and Printouts

### Task 10: Make overall columns and summaries use one 5-player event

**Files:**
- Modify: `src/lib/aggregates/overall.ts`
- Modify: `src/components/scoreboard/RankingTable.tsx`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/summary/route.ts`
- Modify: `src/app/api/public/scoreboard/route.ts`
- Modify: `src/app/admin/tournaments/[tournamentId]/summary/page.tsx`
- Modify: `src/app/admin/tournaments/[tournamentId]/certificates/page.tsx`

- [ ] **Step 1: Write failing tests for overall column order and summary medal data**
- [ ] **Step 2: Remove legacy “skip second half / combine first+second” summary rules**
- [ ] **Step 3: Ensure one 5-player event contributes one overall column**
- [ ] **Step 4: Keep display order helper but now treat 5-player as one event**
- [ ] **Step 5: Verify certificates use one 5-player medal set**
- [ ] **Step 6: Commit**
  - `git commit -m "refactor: treat fives as one event across overall and summary"`

### Task 11: Update print layouts for half-aware single event

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/prints/scores/page.tsx`
- Modify: `src/app/admin/tournaments/[tournamentId]/prints/lanes/page.tsx`

- [ ] **Step 1: Add half labels based on game number ranges instead of event half type**
- [ ] **Step 2: Ensure lane sheets can show first-half and second-half lineup distinctions if needed**
- [ ] **Step 3: Manual QA print preview for 4-game and 6-game fives events**
- [ ] **Step 4: Commit**
  - `git commit -m "feat: print half-aware single-event fives sheets"`

---

## Chunk 7: Data Migration and Cutover

### Task 12: Add migration script from linked events to single event

**Files:**
- Create: `scripts/migrate-fives-to-single-event.ts`
- Modify: any supporting helper files as needed

- [ ] **Step 1: Write dry-run plan and sample output**
- [ ] **Step 2: For each `FIVES FIRST` + linked `FIVES SECOND` pair**
  - choose canonical event id
  - merge event metadata
  - build `phaseSplitGameCount`
  - merge scores into one event with shifted game numbers for second half if necessary
  - merge teams into one team roster + first/second half lineups
  - merge assignments into one event
  - preserve participants/squads
- [ ] **Step 3: Mark legacy linked events archived or remove after validation**
- [ ] **Step 4: Add logging/report output**
- [ ] **Step 5: Test migration on a staging copy first**
- [ ] **Step 6: Commit**
  - `git commit -m "feat: add fives single-event migration script"`

### Task 13: Remove legacy compatibility paths after successful migration

**Files:**
- Delete or simplify legacy code paths identified earlier

- [ ] **Step 1: Remove `linkedEventId`, `halfType`, and `linkedTeamId` reads where no longer needed**
- [ ] **Step 2: Remove copy-from route and old helper code**
- [ ] **Step 3: Remove `buildFivesLinkedLeaderboard` if fully unused**
- [ ] **Step 4: Run full verification**
  - `npm test -- --runInBand`
  - any route/manual QA flows documented above
- [ ] **Step 5: Commit**
  - `git commit -m "cleanup: remove legacy linked fives event flow"`

---

## Migration Notes

- Existing production data currently depends on paired first/second events. Reads should support both old and new models until migration completes.
- The safest rollout is:
  1. Ship compatibility reads
  2. Ship new writes for newly created 5-player events
  3. Migrate historical linked events
  4. Remove legacy code
- Keep a rollback path by preserving legacy event docs until migrated aggregates and scoreboards are verified.

## Verification Checklist

- [ ] New 5-player event can be created without first/second duplicate events
- [ ] Team roster supports 6~7 players
- [ ] First-half lineup and second-half lineup can differ
- [ ] Bench player scores are recorded as individual scores only
- [ ] Active second-half substitute scores count in team total
- [ ] Overall ranking shows one 5-player column
- [ ] Summary/certificates show one 5-player medal set
- [ ] Public scoreboard still renders correct 5-player team ranking

## Risks to Watch

- Bench-player scoring UX is still the least-defined area and should be clarified before implementing assignments.
- Migration of historical second-half assignments and scores must preserve game numbering deterministically.
- Team membership indexing must switch from “active members” to “roster members” without breaking duplicate protection.

Plan complete and saved to `docs/superpowers/plans/2026-03-24-fives-single-event-migration.md`. Ready to execute?
