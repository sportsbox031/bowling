# Public Home User Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public home/detail flow the default user experience after login, unify login into one page, and gate team submission behind player registration messaging.

**Architecture:** Add a shared user-flow helper module, update the public pages and header to consume it, then wire a tournament-management panel into the public detail page. Preserve existing user submission pages, but make them secondary destinations behind the public browsing flow.

**Tech Stack:** Next.js App Router, React client/server components, Firebase auth/session cookies, Jest

---

## Chunk 1: Shared Flow Rules

### Task 1: Add user-flow helper coverage

**Files:**
- Create: `src/lib/__tests__/user-flow.test.ts`
- Create: `src/lib/user-flow.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

## Chunk 2: Login and Header

### Task 2: Unify login behavior and auth CTAs

**Files:**
- Modify: `src/app/(user)/login/page.tsx`
- Modify: `src/app/admin/login/page.tsx`
- Modify: `src/components/PublicHeader.tsx`

- [ ] **Step 1: Cover new helper behavior with tests where possible**
- [ ] **Step 2: Implement the unified login flow and single auth CTA state**
- [ ] **Step 3: Verify the focused tests and app behavior**

## Chunk 3: Public Tournament Management Entry

### Task 3: Surface management from public pages

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/tournaments/[tournamentId]/page.tsx`
- Create: `src/components/user/TournamentManagementPanel.tsx`

- [ ] **Step 1: Add or extend tests for prerequisite/status helpers**
- [ ] **Step 2: Render logged-in management actions from the public flow**
- [ ] **Step 3: Verify the affected tests**

## Chunk 4: Team Submission Dependency Messaging

### Task 4: Explain player-registration dependency at the point of action

**Files:**
- Modify: `src/components/user/UserTournamentWorkspace.tsx`
- Modify: `src/components/user/TeamSubmissionManager.tsx`
- Modify: `src/app/(user)/user/tournaments/[tournamentId]/player-submissions/page.tsx`
- Modify: `src/app/(user)/user/tournaments/[tournamentId]/divisions/[divisionId]/team-submissions/page.tsx`

- [ ] **Step 1: Use helper state to block or explain unavailable team submission**
- [ ] **Step 2: Keep back-links aligned with the public detail flow**
- [ ] **Step 3: Run the relevant tests and a production build or lint if feasible**
