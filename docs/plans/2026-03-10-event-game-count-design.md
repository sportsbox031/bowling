# Event Game Count Scoring Design

## Goal
세부종목에 설정된 `gameCount`만큼만 점수 컬럼과 개인 기록을 생성한다. 이벤트가 4게임이면 공개 점수표, 관리자 점수표, 종합 집계, 선수 프로필 모두 4게임까지만 기록되어야 한다.

## Problem
기존 집계 계층은 `MAX_GAME_COUNT = 6`을 기본값으로 사용해 `gameScores`를 항상 6칸으로 만들었다. 이 때문에 이벤트 설정이 4게임이어도 5G, 6G 빈 칸이 공개 화면과 관리자 화면, 선수 기록 API에 함께 노출됐다.

## Approach Options
1. 집계와 표시를 모두 이벤트 `gameCount` 기준으로 변경한다.
장점: 모든 화면과 API가 일관된다.
단점: scoring 호출부를 전부 함께 수정해야 한다.

2. 화면에서만 `gameCount`까지 잘라서 표시한다.
장점: 수정 범위가 작다.
단점: API와 프로필 데이터에 불필요한 5G, 6G가 남는다.

## Chosen Design
1번을 적용한다.
- `buildEventLeaderboard`가 `gameCount`를 입력으로 받는다.
- 이벤트 집계는 `gameCount` 범위 안의 게임만 반영한다.
- `attempts`도 유효한 게임 수만 세도록 맞춘다.
- `buildOverallLeaderboard`는 각 이벤트 row의 실제 `gameScores.length`를 기준으로 종합 컬럼 수를 계산한다.
- public/admin/profile 호출부는 모두 이벤트 문서의 `gameCount`를 전달한다.

## Verification
- `npx tsc --noEmit`
- `npm run build`
