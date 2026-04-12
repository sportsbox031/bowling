# Coach Auth And Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add coach signup/login, admin approval, organization membership management, player registration submission/approval, and team-entry submission/approval while preserving the current admin scoring flow and minimizing Firestore reads.

**Architecture:** Introduce a request/approval/projection architecture. Coaches write only submission documents, admins approve them, and server-side projection builders update the existing operational collections used by the scoreboard, lane assignment, and scoring features. Separate `entryGroup` (`A/B`) from existing admin `squad` to avoid domain confusion and use summary aggregates to keep read volume within the Firebase free tier.

**Tech Stack:** Next.js App Router, TypeScript, Firebase Auth, Firestore, Firebase Admin SDK, existing bundle/aggregate cache layer

---

## File Structure

### New domain and infrastructure files

- Create: `src/lib/auth/user-session.ts`
- Create: `src/lib/auth/user-guard.ts`
- Create: `src/lib/models-user.ts`
- Create: `src/lib/organizations.ts`
- Create: `src/lib/submissions/player-registration.ts`
- Create: `src/lib/submissions/team-entry.ts`
- Create: `src/lib/projections/player-registration-projection.ts`
- Create: `src/lib/projections/team-entry-projection.ts`
- Create: `src/lib/aggregates/coach-admin-summary.ts`
- Create: `src/lib/entry-group.ts`
- Create: `src/lib/__tests__/entry-group.test.ts`
- Create: `src/lib/__tests__/player-registration-projection.test.ts`
- Create: `src/lib/__tests__/team-entry-projection.test.ts`

### New user-facing pages and components

- Create: `src/app/(user)/layout.tsx`
- Create: `src/app/(user)/login/page.tsx`
- Create: `src/app/(user)/signup/page.tsx`
- Create: `src/app/(user)/pending/page.tsx`
- Create: `src/app/(user)/account/page.tsx`
- Create: `src/app/(user)/organizations/page.tsx`
- Create: `src/app/(user)/tournaments/[tournamentId]/players/page.tsx`
- Create: `src/app/(user)/tournaments/[tournamentId]/events/[eventId]/teams/page.tsx`
- Create: `src/components/user/UserShell.tsx`
- Create: `src/components/user/AccountForm.tsx`
- Create: `src/components/user/OrganizationSelector.tsx`
- Create: `src/components/user/PlayerRegistrationForm.tsx`
- Create: `src/components/user/TeamEntryForm.tsx`

### New admin-facing pages and components

- Create: `src/app/admin/coaches/page.tsx`
- Create: `src/app/admin/coaches/[uid]/page.tsx`
- Create: `src/app/admin/approvals/players/page.tsx`
- Create: `src/app/admin/approvals/teams/page.tsx`
- Create: `src/components/admin/CoachApprovalTable.tsx`
- Create: `src/components/admin/CoachOrganizationEditor.tsx`
- Create: `src/components/admin/PlayerSubmissionReview.tsx`
- Create: `src/components/admin/TeamSubmissionReview.tsx`

### New API routes

- Create: `src/app/api/user/session/route.ts`
- Create: `src/app/api/user/profile/route.ts`
- Create: `src/app/api/user/organizations/route.ts`
- Create: `src/app/api/user/organizations/requests/route.ts`
- Create: `src/app/api/user/tournaments/[tournamentId]/player-submissions/route.ts`
- Create: `src/app/api/user/tournaments/[tournamentId]/team-submissions/route.ts`
- Create: `src/app/api/admin/coaches/route.ts`
- Create: `src/app/api/admin/coaches/[uid]/route.ts`
- Create: `src/app/api/admin/coaches/[uid]/password-reset/route.ts`
- Create: `src/app/api/admin/approvals/player-submissions/route.ts`
- Create: `src/app/api/admin/approvals/player-submissions/[submissionId]/route.ts`
- Create: `src/app/api/admin/approvals/team-submissions/route.ts`
- Create: `src/app/api/admin/approvals/team-submissions/[submissionId]/route.ts`

### Existing files to modify

- Modify: `src/lib/models.ts`
- Modify: `src/lib/firebase/schema.ts`
- Modify: `src/lib/auth/admin.ts`
- Modify: `src/lib/auth/guard.ts`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/components/PublicHeader.tsx`
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/participants/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/route.ts`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/[teamId]/route.ts`
- Modify: `src/lib/api-cache.ts`
- Modify: `firestore.rules`
- Modify: `docs/firestore-schema.md`
- Modify: `docs/system-architecture.md`

---

## Chunk 1: Authentication, Coach Profile, And Organization Model

### Task 1: Add user-facing domain models

**Files:**
- Create: `src/lib/models-user.ts`
- Modify: `src/lib/models.ts`
- Modify: `src/lib/firebase/schema.ts`
- Test: `src/lib/__tests__/entry-group.test.ts`

- [ ] Define types for `UserProfile`, `Organization`, `UserOrganizationMembership`, `PlayerRegistrationSubmission`, `TeamEntrySubmission`, `ApprovalStatus`, and `EntryGroup`.
- [ ] Extend Firestore path helpers with exact collection paths for users, organizations, memberships, and submissions.
- [ ] Add explicit status enums instead of stringly-typed flags.
- [ ] Add `EntryGroup` type for `A | B` and keep it separate from existing `squad` fields.
- [ ] Run focused import/type sanity check.
- [ ] Commit.

### Task 2: Add user session and guard utilities

**Files:**
- Create: `src/lib/auth/user-session.ts`
- Create: `src/lib/auth/user-guard.ts`
- Modify: `src/lib/auth/admin.ts`
- Test: `src/lib/__tests__/validation.test.ts`

- [ ] Implement user session read helpers for Firebase Auth-backed user pages.
- [ ] Add guard helpers that classify user access into `pending-only` versus `approved`.
- [ ] Keep admin auth completely separate from user auth to avoid privilege mixing.
- [ ] Add validation helpers for approved/pending states.
- [ ] Run focused import/type sanity check.
- [ ] Commit.

### Task 3: Add organization helpers

**Files:**
- Create: `src/lib/organizations.ts`
- Test: `src/lib/__tests__/team-identity.test.ts`

- [ ] Add helpers to normalize organization names, detect duplicates, and validate whether a user can operate on a given organization.
- [ ] Add helper to select a representative organization label for summaries.
- [ ] Keep membership logic here instead of scattering organization checks through route handlers.
- [ ] Run focused tests if new pure functions are added.
- [ ] Commit.

## Chunk 2: Signup, Login, Pending State, And Account Management

### Task 4: Build signup and login UI

**Files:**
- Create: `src/app/(user)/layout.tsx`
- Create: `src/app/(user)/login/page.tsx`
- Create: `src/app/(user)/signup/page.tsx`
- Create: `src/components/user/UserShell.tsx`
- Create: `src/components/user/AccountForm.tsx`

- [ ] Create a user area layout that is clearly separate from admin.
- [ ] Build signup form with required fields:
  - `담당자`
  - `연락처`
  - `메일주소`
  - `담당단체명(1개 이상)`
  - `개인정보 동의`
- [ ] Build login form using Firebase Auth.
- [ ] Keep pending-state copy explicit: login succeeds but workflow features remain blocked until admin approval.
- [ ] Commit.

### Task 5: Add user profile/session APIs

**Files:**
- Create: `src/app/api/user/session/route.ts`
- Create: `src/app/api/user/profile/route.ts`
- Modify: `src/lib/firebase/schema.ts`

- [ ] Implement a session route that returns only the minimal fields needed for shell gating.
- [ ] Implement profile read/update API for account management.
- [ ] Allow password change and personal info updates, but keep email ownership tied to Firebase Auth.
- [ ] Ensure pending users can access only profile/session APIs.
- [ ] Commit.

### Task 6: Build pending and account pages

**Files:**
- Create: `src/app/(user)/pending/page.tsx`
- Create: `src/app/(user)/account/page.tsx`
- Modify: `src/components/PublicHeader.tsx`

- [ ] Add pending page that explains approval state and blocks workflow navigation.
- [ ] Add account page for profile edits and password change flow.
- [ ] Add routing guard so pending users are redirected here instead of seeing operational pages.
- [ ] Keep top-level navigation minimal to reduce accidental reads.
- [ ] Commit.

## Chunk 3: Coach Admin And Organization Membership Management

### Task 7: Add coach admin summary aggregate

**Files:**
- Create: `src/lib/aggregates/coach-admin-summary.ts`
- Create: `src/app/api/admin/coaches/route.ts`

- [ ] Build a lightweight summary aggregate for coach list screens.
- [ ] Include only:
  - approval status
  - organization count
  - representative organization
  - timestamps
- [ ] Rebuild summary only when coach/member/org state changes.
- [ ] Avoid N+1 membership reads on list screens.
- [ ] Commit.

### Task 8: Add coach management UI

**Files:**
- Create: `src/app/admin/coaches/page.tsx`
- Create: `src/app/admin/coaches/[uid]/page.tsx`
- Create: `src/components/admin/CoachApprovalTable.tsx`
- Create: `src/components/admin/CoachOrganizationEditor.tsx`
- Modify: `src/app/admin/layout.tsx`

- [ ] Add `지도자 관리` menu entry.
- [ ] Create coach list page with approval status filters.
- [ ] Create coach detail page with:
  - profile
  - organizations
  - approve/reject/disable
  - remove membership
  - password reset
- [ ] Keep organization management inside coach detail, not as a detached top-level screen.
- [ ] Commit.

### Task 9: Add coach approval and password reset APIs

**Files:**
- Create: `src/app/api/admin/coaches/[uid]/route.ts`
- Create: `src/app/api/admin/coaches/[uid]/password-reset/route.ts`

- [ ] Implement admin-only routes for approval status changes.
- [ ] Implement admin password reset initiation.
- [ ] Record approval actor and timestamp for auditability.
- [ ] Invalidate only coach summary/profile caches affected by the change.
- [ ] Commit.

## Chunk 4: Player Registration Submission And Approval

### Task 10: Add player registration domain and entry-group helpers

**Files:**
- Create: `src/lib/submissions/player-registration.ts`
- Create: `src/lib/projections/player-registration-projection.ts`
- Create: `src/lib/entry-group.ts`
- Create: `src/lib/__tests__/entry-group.test.ts`
- Create: `src/lib/__tests__/player-registration-projection.test.ts`

- [ ] Implement validation rules for player registration submission payloads.
- [ ] Implement `assignEntryGroups(players)` helper:
  - `1~6 => A`
  - `7+ => B`
- [ ] Keep this helper completely independent from admin `squad` logic.
- [ ] Implement projection helper that writes approved players into tournament-scoped operational collections.
- [ ] Add tests for:
  - group assignment
  - duplicate rejection
  - approved projection shape
- [ ] Commit.

### Task 11: Add player submission APIs

**Files:**
- Create: `src/app/api/user/tournaments/[tournamentId]/player-submissions/route.ts`
- Create: `src/app/api/admin/approvals/player-submissions/route.ts`
- Create: `src/app/api/admin/approvals/player-submissions/[submissionId]/route.ts`

- [ ] Let approved coaches create submission documents only for their organizations.
- [ ] Let admins list pending submissions through a summary-first path.
- [ ] On approval:
  - validate organization membership
  - assign `entryGroup`
  - write projection
  - update summary aggregate
- [ ] On rejection:
  - preserve submission document and audit trail
  - do not touch projection
- [ ] Commit.

### Task 12: Build player submission UI

**Files:**
- Create: `src/app/(user)/tournaments/[tournamentId]/players/page.tsx`
- Create: `src/components/user/OrganizationSelector.tsx`
- Create: `src/components/user/PlayerRegistrationForm.tsx`
- Create: `src/components/admin/PlayerSubmissionReview.tsx`

- [ ] Add user page for tournament player registration by selected approved organization.
- [ ] Show only organizations linked to the logged-in coach.
- [ ] Add admin review UI for approve/reject with submission-level actions.
- [ ] Make personal event participation automatic after approval; do not reintroduce a separate personal participant registration step.
- [ ] Commit.

## Chunk 5: Team Entry Submission And Approval

### Task 13: Add team entry domain and projection helpers

**Files:**
- Create: `src/lib/submissions/team-entry.ts`
- Create: `src/lib/projections/team-entry-projection.ts`
- Create: `src/lib/__tests__/team-entry-projection.test.ts`

- [ ] Implement validation for doubles/triples/fives submission payloads.
- [ ] Enforce:
  - approved players only
  - same organization only
  - same `entryGroup` only
  - correct team size per event
- [ ] Projection helper should write into existing operational `teams`/`participants` structures used by admin scoreboard.
- [ ] Preserve current 5-player single-event lineup model.
- [ ] Commit.

### Task 14: Add team submission APIs

**Files:**
- Create: `src/app/api/user/tournaments/[tournamentId]/team-submissions/route.ts`
- Create: `src/app/api/admin/approvals/team-submissions/route.ts`
- Create: `src/app/api/admin/approvals/team-submissions/[submissionId]/route.ts`

- [ ] Let approved coaches submit team entries only after player registration approval exists.
- [ ] Limit query scope by:
  - tournament
  - division
  - event
  - organization
  - entryGroup
- [ ] On approval, write operational team projection and invalidate only relevant event bundle caches.
- [ ] Commit.

### Task 15: Build team submission and admin review UI

**Files:**
- Create: `src/app/(user)/tournaments/[tournamentId]/events/[eventId]/teams/page.tsx`
- Create: `src/components/user/TeamEntryForm.tsx`
- Create: `src/app/admin/approvals/teams/page.tsx`
- Create: `src/components/admin/TeamSubmissionReview.tsx`

- [ ] Build coach UI for 2/3/5-player team submission.
- [ ] Show only approved players from the selected organization and chosen `entryGroup`.
- [ ] Add admin approval screen for team submissions.
- [ ] Keep wording explicit that `A/B` is an entry grouping rule, not an admin squad.
- [ ] Commit.

## Chunk 6: Integrate With Existing Admin Operational Flow

### Task 16: Remove personal participant registration from admin flow

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/participants/route.ts`

- [ ] For singles events, remove manual participant registration UI and replace it with approved-player projection status.
- [ ] Keep team-event participant handling intact.
- [ ] Ensure admin scoreboard reads personal participants from approved projection only.
- [ ] Commit.

### Task 17: Keep current admin scoring flow for approved entries

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`
- Modify: existing bundle and team APIs only where needed

- [ ] Ensure that once team/player submissions are approved, the current admin flow continues:
  - squad split
  - lane assignment
  - score entry
  - rankings
- [ ] Do not let pending/unapproved submissions leak into operational screens.
- [ ] Commit.

## Chunk 7: Read Optimization, Caching, And Security Hardening

### Task 18: Add targeted summary aggregates and cache invalidation

**Files:**
- Modify: `src/lib/api-cache.ts`
- Create or modify: aggregate builders for coach/submission summaries

- [ ] Add cache keys scoped tightly to:
  - coach summary
  - player submission summary
  - team submission summary
- [ ] Invalidate only affected tournament/division/event ranges after approval.
- [ ] Avoid full tournament scans in user and admin approval flows.
- [ ] Commit.

### Task 19: Add Firestore rules for user workflows

**Files:**
- Modify: `firestore.rules`

- [ ] Add rules so coaches can access only:
  - their own profile
  - their memberships
  - their own submission docs
- [ ] Keep operational collections admin-only for writes.
- [ ] Allow public reads only where current product already intends them.
- [ ] Commit.

### Task 20: Add security verification and abuse checks

**Files:**
- Modify: relevant user/admin API routes
- Update: `docs/system-architecture.md`

- [ ] Add server validation for cross-organization spoofing, duplicate submissions, and unauthorized approvals.
- [ ] Add rate-limit or throttling where practical for signup and submission APIs.
- [ ] Review secrets and auth boundaries to ensure coach routes cannot reach admin actions.
- [ ] Commit.

## Chunk 8: Documentation, Migration, And Rollout

### Task 21: Update architecture and schema docs

**Files:**
- Modify: `docs/firestore-schema.md`
- Modify: `docs/system-architecture.md`
- Modify: `docs/implementation-roadmap.md`

- [ ] Document request/approval/projection architecture.
- [ ] Document new collections and read-optimization strategy.
- [ ] Document the distinction between `entryGroup` and `squad`.
- [ ] Commit.

### Task 22: Define migration and rollout path

**Files:**
- Create: `docs/plans/2026-03-26-coach-auth-rollout.md` or update this plan with rollout notes

- [ ] Define rollout order:
  - auth/profile
  - coach approval
  - player submission approval
  - personal auto-participation
  - team submission approval
- [ ] Define temporary coexistence behavior with current admin-only workflows.
- [ ] Define backfill requirements for current tournaments if needed.
- [ ] Commit.

### Task 23: Final verification checklist

**Files:**
- No new files required; run verification commands

- [ ] Verify signup -> pending -> admin approval -> approved login flow.
- [ ] Verify organization membership restrictions.
- [ ] Verify player submission approval creates personal-event participation automatically.
- [ ] Verify `A/B` grouping is assigned at approval time and enforced in 2/3/5-player team entry.
- [ ] Verify approved team entries still work with current admin squad/lane/score/ranking flow.
- [ ] Verify cache invalidation does not require broad full-tournament scans.
- [ ] Commit final integrated chunk.

---

## Notes

- Treat this as a multi-phase rollout, not one giant patch.
- Keep request models and operational models separate throughout.
- Never mix `entryGroup` and `squad` in names, helpers, or UI copy.
- Prefer aggregate rebuilds triggered on approval events instead of repeated large reads from UI screens.
- When changing any part of this workflow, follow `docs/engineering-principles.md`.

