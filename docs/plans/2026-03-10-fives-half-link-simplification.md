# 5인조 전후반 연동 단순화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 5인조 후반전 생성 시 전반전 데이터를 1회 복사하도록 바꾸고, 직접 연결하던 복잡한 UI를 단순한 생성 흐름으로 교체한다.

**Architecture:** 관리자 이벤트 등록 화면에서 후반전 생성용 입력을 단순화하고, 서버에는 전반전 이벤트를 소스로 받아 `participants`, `squads`, `teams`를 복사하는 전용 API를 추가한다. 팀 종합점수 계산은 기존 `linkedEventId`와 `halfType` 기반 집계를 유지하되, 후반전 팀 구성은 후반전 팀 문서 기준으로 독립 동작하게 둔다.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Firebase Admin Firestore

---

### Task 1: 5인조 후반전 복사 API

**Files:**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/route.ts`
- Create: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/copy-from/[sourceEventId]/route.ts`
- Verify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/bundle/route.ts`

**Step 1: Write the failing test**

- 후반전 이벤트에 전반전의 `participants`, `squads`, `teams`가 복사되는 테스트를 작성한다.
- 스쿼드 ID 재매핑과 `participant.squadId` 변환을 포함한다.

**Step 2: Run test to verify it fails**

Run: 프로젝트의 기존 테스트 명령으로 새 테스트만 실행
Expected: 복사 API가 없거나 기대 데이터가 없어 FAIL

**Step 3: Write minimal implementation**

- 소스/대상 이벤트 존재 여부와 5인조 여부를 검증한다.
- 기존 대상 이벤트 하위 데이터가 있으면 중복 복사를 막는 정책을 적용한다.
- `participants`, `squads`, `teams`를 읽어 후반전으로 복사한다.

**Step 4: Run test to verify it passes**

Run: 동일 테스트 명령
Expected: PASS

### Task 2: 관리자 이벤트 등록 UI 정리

**Files:**
- Modify: `src/app/admin/tournaments/[tournamentId]/page.tsx`

**Step 1: Write the failing test**

- 테스트 체계가 있다면 후반전 선택 시 기존 직접 연결 UI가 보이지 않고 전반전 선택 UI만 보이는 테스트를 추가한다.
- 별도 UI 테스트가 없다면 저장 payload 조립 함수를 분리해 단위 테스트를 작성한다.

**Step 2: Run test to verify it fails**

Run: 관련 테스트 명령
Expected: 기존 UI 구조 때문에 FAIL

**Step 3: Write minimal implementation**

- `연결된 이벤트` 선택을 제거하고 `후반전일 때 전반전 선택`으로 교체한다.
- 후반전 생성 성공 후 `confirm` 창을 띄우고 확인 시 복사 API를 호출한다.
- 취소하면 이벤트 생성만 마무리한다.

**Step 4: Run test to verify it passes**

Run: 동일 테스트 명령
Expected: PASS

### Task 3: 자동 팀 복제 충돌 제거

**Files:**
- Modify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/teams/route.ts`
- Verify: `src/app/admin/tournaments/[tournamentId]/scoreboard/page.tsx`

**Step 1: Write the failing test**

- 초기 복사 이후 후반전 팀 수정이 전반전에 자동 반영되지 않아야 함을 검증하는 테스트를 작성한다.

**Step 2: Run test to verify it fails**

Run: 관련 테스트 명령
Expected: 기존 연결 이벤트 자동 팀 생성 로직 때문에 FAIL

**Step 3: Write minimal implementation**

- `linkedEventId` 기반 자동 팀 복제 로직을 제거하거나 초기화 단계로 한정한다.
- 후반전 선수교체는 후반전 팀 문서만 바꾸도록 유지한다.

**Step 4: Run test to verify it passes**

Run: 동일 테스트 명령
Expected: PASS

### Task 4: 5인조 합산 점수 회귀 검증

**Files:**
- Verify: `src/app/api/admin/tournaments/[tournamentId]/divisions/[divisionId]/events/[eventId]/bundle/route.ts`
- Modify: 필요 시 `src/lib/models.ts`

**Step 1: Write the failing test**

- 전반과 후반의 팀 구성이 달라도 `linkedEventId` 기반 합산 팀 순위가 유지되는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: 관련 테스트 명령
Expected: 집계나 타입 가정이 깨지면 FAIL

**Step 3: Write minimal implementation**

- 필요한 타입과 집계 경로를 보정한다.
- 후반전 `memberIds` 기준 점수가 합산되는지 확인한다.

**Step 4: Run test to verify it passes**

Run: 관련 테스트와 빌드
Expected: PASS
