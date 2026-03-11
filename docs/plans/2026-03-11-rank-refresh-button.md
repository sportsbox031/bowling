# Rank Refresh Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 점수 저장은 가볍게 유지하고, 관리자 화면에서 `순위 반영` 버튼을 눌렀을 때만 무거운 aggregate 재계산이 실행되도록 만든다.

**Architecture:** 점수 저장 API에서 aggregate 재계산을 제거하고, 별도 rank-refresh API로 옮긴다. 관리 화면은 점수 저장 후 로컬 상태만 갱신하면서 `순위 미반영` 상태를 표시하고, 버튼 클릭 시 aggregate를 재생성한 뒤 순위 데이터를 다시 조회한다.

**Tech Stack:** Next.js 14 app router, React 18, TypeScript, Firebase Admin, Node built-in assert

---

### Task 1: aggregate 재계산 분리

**Files:**
- Modify: `src/app/api/admin/score/route.ts`
- Create: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/rank-refresh/route.ts`
- Test: `scripts/test-rank-refresh-state.ts`

**Step 1: Write the failing test**

점수 저장 후에는 `rank refresh pending` 상태가 유지되고, 별도 액션에서만 상태가 해제되는 최소 상태 전이 테스트를 작성한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/test-rank-refresh-state.ts`
Expected: FAIL because helper or route contract is missing

**Step 3: Write minimal implementation**

점수 저장 시 aggregate 재계산 대신 pending 상태만 남기고, 새 API에서 aggregate 재계산과 캐시 무효화를 수행한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/test-rank-refresh-state.ts`
Expected: PASS

### Task 2: 관리자 UI 연결

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

**Step 1: Add local refresh-pending state**

점수 저장 성공 시 `순위 미반영` 상태를 세팅하고, 점수표는 기존 로컬 상태를 즉시 갱신한다.

**Step 2: Add rank refresh button**

버튼명은 `순위 반영`으로 두고, 클릭 시 새 API 호출 후 순위 데이터만 재조회한다.

**Step 3: Show explicit status**

`순위 미반영` / `순위 반영 완료`와 마지막 반영 시각을 표시한다.

### Task 3: verification

**Files:**
- Modify: related files above only

**Step 1: Run targeted test**

Run: `node --experimental-strip-types scripts/test-rank-refresh-state.ts`
Expected: PASS

**Step 2: Run production verification**

Run: `npm run build`
Expected: build succeeds
