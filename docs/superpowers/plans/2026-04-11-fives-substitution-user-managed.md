# Fives Substitution User-Managed Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5인조 선수교체를 관리자 수동 편집에서 사용자 제출 + 관리자 승인 흐름으로 전환한다.

**Architecture:** 초기 팀편성 제출은 `로스터 + 전반 5명`만 다루고, 후반 교체는 별도의 제출/승인 도메인으로 분리한다. 운영 상태는 이벤트에 `후반 교체 제출 가능` 플래그를 두고, 사용자 화면은 이 상태와 승인 상태에 따라 버튼을 열고 닫는다. 관리자 스코어보드는 승인 결과만 읽는 방향으로 점진적으로 축소한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Firebase Admin/Firestore, Jest

---

## File Map

### Existing files to modify

- `src/components/user/TeamSubmissionManager.tsx`
  - 5인조 팀편성 UI를 `로스터 + 전반 5명` 중심으로 축소
- `src/lib/submissions/team-entry.ts`
  - 5인조 초기 제출의 정규화/검증 규칙 변경
- `src/lib/projections/team-entry-projection.ts`
  - 팀 승인 시 전반 기준으로 팀 문서 반영
- `src/app/api/user/tournaments/[tournamentId]/team-submissions/route.ts`
  - 초기 팀편성 제출 검증을 전반 기준으로 조정
- `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`
  - 후반 교체 직접 편집 UI를 축소하고 승인된 결과 참조로 변경
- `src/lib/team-lineup.ts`
  - 후반 라인업 조회 소스를 교체 제출 승인본과 결합할 수 있게 확장
- `src/lib/aggregates/event-scoreboard.ts`
  - 후반 승인 라인업 반영
- `src/lib/scoring.ts`
  - 5인조 후반 라인업 사용 경로 점검
- `src/app/admin/page.tsx`
  - 관리자 대시보드에 후반 교체 대기 현황 추가
- `src/components/admin/AdminRequestDashboard.tsx`
  - 후반 교체 요청 요약 패널 추가
- `src/app/(user)/user/tournaments/[tournamentId]/page.tsx`
  - 사용자 대회관리 허브에 후반 교체 제출 액션 추가
- `src/components/user/UserTournamentWorkspace.tsx`
  - 후반 교체 제출 버튼 상태 노출

### New files to create

- `src/lib/submissions/fives-substitution.ts`
  - 후반 교체 제출 정규화/검증 유틸
- `src/lib/projections/fives-substitution-projection.ts`
  - 후반 교체 승인 시 팀 문서 반영
- `src/app/api/user/tournaments/[tournamentId]/fives-substitutions/route.ts`
  - 사용자 후반 교체 제출/조회 API
- `src/app/api/admin/approvals/fives-substitutions/route.ts`
  - 관리자 승인 대기 목록 API
- `src/app/api/admin/approvals/fives-substitutions/[submissionId]/route.ts`
  - 관리자 승인/반려 API
- `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/fives-substitution-window/route.ts`
  - 관리자 제출창 오픈/닫기 API
- `src/components/user/FivesSubstitutionManager.tsx`
  - 사용자 후반 교체 제출 UI
- `src/app/(user)/user/tournaments/[tournamentId]/fives-substitutions/page.tsx`
  - 사용자 후반 교체 제출 페이지
- `src/components/admin/FivesSubstitutionApprovalPanel.tsx`
  - 관리자 후반 교체 승인 패널
- `src/lib/__tests__/fives-substitution-submission.test.ts`
  - 후반 교체 제출 정규화/검증 테스트
- `src/lib/__tests__/fives-substitution-projection.test.ts`
  - 승인 반영 테스트
- `src/lib/__tests__/team-submission-fives-first-half.test.ts`
  - 초기 팀편성에서 후반 분리 테스트

---

## Chunk 1: Initial Fives Submission Refactor

### Task 1: 5인조 초기 제출 규칙을 전반 중심으로 바꾸기

**Files:**
- Modify: `src/components/user/TeamSubmissionManager.tsx`
- Modify: `src/lib/submissions/team-entry.ts`
- Modify: `src/app/api/user/tournaments/[tournamentId]/team-submissions/route.ts`
- Test: `src/lib/__tests__/team-entry-submission.test.ts`
- Create: `src/lib/__tests__/team-submission-fives-first-half.test.ts`

- [ ] **Step 1: Write the failing tests**

검증할 내용:
- 5인조 제출은 `rosterIds` 5~7명 허용
- `firstHalfMemberIds` 5명 필수
- `secondHalfMemberIds`는 초기 제출에서 강제하지 않음
- 전반 5명이 로스터 안에 있어야 함

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- team-entry-submission.test.ts team-submission-fives-first-half.test.ts`

- [ ] **Step 3: Implement minimal code**

구현 기준:
- `normalizeTeamEntryTeams("FIVES", ...)`가 전반 5명만 정규화하도록 변경
- API에서 초기 제출은 후반 라인업 미제출 허용
- UI에서 5인조일 때 후반 선택 영역 제거

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- team-entry-submission.test.ts team-submission-fives-first-half.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/user/TeamSubmissionManager.tsx src/lib/submissions/team-entry.ts src/app/api/user/tournaments/[tournamentId]/team-submissions/route.ts src/lib/__tests__/team-entry-submission.test.ts src/lib/__tests__/team-submission-fives-first-half.test.ts
git commit -m "refactor: split fives initial submission to first-half only"
```

---

## Chunk 2: Fives Substitution Domain

### Task 2: 후반 교체 제출 모델과 검증 유틸 추가

**Files:**
- Modify: `src/lib/models-user.ts`
- Modify: `src/lib/firebase/schema.ts`
- Create: `src/lib/submissions/fives-substitution.ts`
- Test: `src/lib/__tests__/fives-substitution-submission.test.ts`

- [ ] **Step 1: Write the failing tests**

검증할 내용:
- 후반 교체는 5명 정확히 선택해야 함
- 로스터 밖 선수는 불가
- 같은 팀 로스터 안에서만 제출 가능
- 5인조 이벤트가 아니면 불가

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fives-substitution-submission.test.ts`

- [ ] **Step 3: Write minimal implementation**

구현 기준:
- `FivesSubstitutionSubmission` 타입 추가
- Firestore path helper 추가
- 정규화/검증 유틸 구현

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fives-substitution-submission.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/models-user.ts src/lib/firebase/schema.ts src/lib/submissions/fives-substitution.ts src/lib/__tests__/fives-substitution-submission.test.ts
git commit -m "feat: add fives substitution submission domain"
```

---

## Chunk 3: User Submission APIs

### Task 3: 사용자 후반 교체 제출/조회 API 추가

**Files:**
- Create: `src/app/api/user/tournaments/[tournamentId]/fives-substitutions/route.ts`
- Modify: `src/lib/organization-membership-access.ts` if shared access helper is needed
- Test: `src/lib/__tests__/fives-substitution-submission.test.ts`

- [ ] **Step 1: Write the failing API-oriented tests or helper tests**

최소 검증:
- 팀편성 승인 전 제출 거부
- 제출창 미오픈 상태에서 거부
- 승인 대기 중복 제출 거부
- 반려 후 재제출 허용

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- fives-substitution-submission.test.ts`

- [ ] **Step 3: Implement minimal API**

요구사항:
- `GET`: 내 후반 교체 제출 목록 조회
- `POST`: 제출 생성
- 검증:
  - 승인된 5인조 팀 존재
  - 요청자 단체 승인 여부
  - 이벤트 오픈 여부
  - 제출 횟수/상태 제약

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fives-substitution-submission.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/user/tournaments/[tournamentId]/fives-substitutions/route.ts src/lib/__tests__/fives-substitution-submission.test.ts
git commit -m "feat: add user fives substitution submission api"
```

---

## Chunk 4: User UI Flow

### Task 4: 사용자 후반 교체 제출 화면 추가

**Files:**
- Create: `src/components/user/FivesSubstitutionManager.tsx`
- Create: `src/app/(user)/user/tournaments/[tournamentId]/fives-substitutions/page.tsx`
- Modify: `src/components/user/UserTournamentWorkspace.tsx`

- [ ] **Step 1: Write the failing UI state expectations in helper tests if practical**

최소 helper 테스트:
- 버튼 잠금 규칙
- 팀별 제출 가능 상태

- [ ] **Step 2: Implement minimal UI**

요구사항:
- 승인된 5인조 팀만 노출
- 전반 출전 5명 + 로스터 + 벤치 표시
- 후반 5명 선택 UI
- 제출 후 상태 반영
- 사용자 허브에서 조건 충족 시에만 진입 가능

- [ ] **Step 3: Verify manually in dev server**

체크:
- `/user/tournaments/[id]`에서 버튼 상태 변화
- `/user/tournaments/[id]/fives-substitutions`
- 제출 후 `승인 대기` 표시

- [ ] **Step 4: Run build and related tests**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/user/FivesSubstitutionManager.tsx src/app/(user)/user/tournaments/[tournamentId]/fives-substitutions/page.tsx src/components/user/UserTournamentWorkspace.tsx
git commit -m "feat: add user fives substitution submission flow"
```

---

## Chunk 5: Admin Control and Approval

### Task 5: 관리자 후반 교체 제출창 오픈/닫기 API 추가

**Files:**
- Create: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/fives-substitution-window/route.ts`
- Modify: `src/app/admin/tournaments/[tournamentId]/page.tsx` or event management surface

- [ ] **Step 1: Add failing helper tests if extraction is needed**

- [ ] **Step 2: Implement API**

요구사항:
- 관리자만 접근 가능
- 이벤트 문서에 `fivesSubstitutionWindowOpen` 상태 저장
- 오픈/닫기 시각 기록

- [ ] **Step 3: Add minimal admin trigger UI**

위치:
- 이벤트 운영 설정 영역

- [ ] **Step 4: Run build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/fives-substitution-window/route.ts src/app/admin/tournaments/[tournamentId]/page.tsx
git commit -m "feat: add admin control for fives substitution window"
```

### Task 6: 관리자 후반 교체 승인 패널 추가

**Files:**
- Create: `src/app/api/admin/approvals/fives-substitutions/route.ts`
- Create: `src/app/api/admin/approvals/fives-substitutions/[submissionId]/route.ts`
- Create: `src/components/admin/FivesSubstitutionApprovalPanel.tsx`
- Modify: `src/components/admin/AdminRequestDashboard.tsx`

- [ ] **Step 1: Write failing tests for projection/approval helpers**

- [ ] **Step 2: Implement approval list and action APIs**

- [ ] **Step 3: Implement approval panel UI**

표시:
- 팀명
- 전반 5명
- 후반 요청 5명
- 교체된 선수 비교
- 승인/반려 버튼

- [ ] **Step 4: Extend admin dashboard**

대기 건수와 최근 요청 링크 노출

- [ ] **Step 5: Run build and tests**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/approvals/fives-substitutions/route.ts src/app/api/admin/approvals/fives-substitutions/[submissionId]/route.ts src/components/admin/FivesSubstitutionApprovalPanel.tsx src/components/admin/AdminRequestDashboard.tsx
git commit -m "feat: add admin approval flow for fives substitutions"
```

---

## Chunk 6: Projection and Scoreboard Integration

### Task 7: 승인된 후반 교체안을 팀 문서와 스코어 계산에 반영

**Files:**
- Create: `src/lib/projections/fives-substitution-projection.ts`
- Modify: `src/lib/team-lineup.ts`
- Modify: `src/lib/projections/team-entry-projection.ts`
- Modify: `src/lib/aggregates/event-scoreboard.ts`
- Modify: `src/lib/scoring.ts`
- Test: `src/lib/__tests__/fives-substitution-projection.test.ts`
- Modify: `src/lib/__tests__/team-lineup.test.ts`
- Modify: `src/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing projection and lineup tests**

검증:
- 승인 전에는 전반 라인업 유지
- 승인 후 후반 게임에서 후반 라인업 사용
- 출력/집계가 승인 후반 라인업 기준으로 계산

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- fives-substitution-projection.test.ts team-lineup.test.ts scoring.test.ts`

- [ ] **Step 3: Implement minimal projection**

구현 기준:
- 승인 시 팀 문서의 후반 라인업 반영 또는 별도 승인본 참조 연결
- `getTeamActiveMemberIdsForGame` 경로에서 승인본 사용

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fives-substitution-projection.test.ts team-lineup.test.ts scoring.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/projections/fives-substitution-projection.ts src/lib/team-lineup.ts src/lib/projections/team-entry-projection.ts src/lib/aggregates/event-scoreboard.ts src/lib/scoring.ts src/lib/__tests__/fives-substitution-projection.test.ts src/lib/__tests__/team-lineup.test.ts src/lib/__tests__/scoring.test.ts
git commit -m "feat: apply approved fives substitutions to lineup and scoring"
```

---

## Chunk 7: Scoreboard Cleanup

### Task 8: 관리자 스코어보드의 직접 교체 UI 축소

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

- [ ] **Step 1: Identify and isolate direct-edit sections**

대상:
- `선수교체`
- 로스터 편집 상태
- 전반/후반 직접 선택 UI

- [ ] **Step 2: Replace with status/view UI**

표시:
- 승인된 전반/후반 라인업
- 후반 교체 승인 대기 여부
- 직접 수정 대신 승인 화면 이동 링크

- [ ] **Step 3: Run build and manual verification**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx
git commit -m "refactor: reduce direct fives substitution editing in scoreboard"
```

---

## Final Verification

- [ ] Run targeted tests

```bash
npm test -- team-entry-submission.test.ts team-submission-fives-first-half.test.ts fives-substitution-submission.test.ts fives-substitution-projection.test.ts team-lineup.test.ts scoring.test.ts
```

- [ ] Run full build

```bash
npm run build
```

- [ ] Manual QA in dev server

체크 경로:
- `/user/tournaments/[id]/team-submissions`
- `/user/tournaments/[id]/fives-substitutions`
- `/admin`
- `/admin/coaches`
- `/admin/tournaments/[id]`
- `/admin/tournaments/[id]/scoreboard?...`

- [ ] Confirm DB-side artifacts

확인 대상:
- `teamEntrySubmissions`
- 신규 `fivesSubstitutionSubmissions`
- 이벤트 오픈 플래그
- 승인 후 팀 문서 라인업 반영

---

Plan complete and saved to `docs/superpowers/plans/2026-04-11-fives-substitution-user-managed.md`. Ready to execute?
