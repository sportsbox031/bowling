# Event Game Count Implementation Plan

## Scope
- `src/lib/scoring.ts`
- public scoreboard routes
- admin bundle and summary routes
- player profile route
- shared scoring service types

## Steps
1. `buildEventLeaderboard`에 `gameCount`를 추가하고 유효 게임만 집계한다.
2. `buildOverallLeaderboard`가 이벤트별 실제 게임 열 수를 기준으로 종합 컬럼 수를 계산하게 한다.
3. public/admin/profile 모든 호출부에서 이벤트 문서의 `gameCount`를 전달한다.
4. 타입체크와 프로덕션 빌드로 회귀를 검증한다.

## Done
- scoring 계층을 이벤트별 동적 게임 수로 전환
- 공개 점수표, 종합 API, 선수 프로필, 관리자 bundle/summary 호출부 반영
- `npx tsc --noEmit` 통과
- `npm run build` 통과
