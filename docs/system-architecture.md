# 시스템 구조 (Firebase 기반)

## 아키텍처 개요
- Frontend: Next.js 14(App Router)
- Backend: Next.js Route Handlers + Firebase Admin SDK
- DB: Cloud Firestore
- 실시간: Firestore 실시간 리스너
- 인증: Firebase Auth(관리자)
- 배포: Vercel(프론트+서버), Firebase Emulator(개발/테스트)

## 핵심 계층
1. Web UI
   - 대회 조회/성적표/종합성적 사용자 페이지
   - 관리자 운영 페이지(대회/종별/세부종목/선수/점수)
2. API/서비스 계층
   - Route Handler 또는 Server Action
   - 데이터 검증(Zod 또는 `ts` type guard)
   - 도메인 규칙 적용
3. Firestore
   - 대회 단위 데이터 격리
   - 점수 이벤트 기반 실시간 업데이트 트리거

## 제안 컬렉션 구조
- tournaments (문서)
- tournaments/{tournamentId}/divisions (종별)
- tournaments/{tournamentId}/divisions/{divisionId}/events (세부종목)
- tournaments/{tournamentId}/players (대회 선수)
- tournaments/{tournamentId}/scores/{eventId}? (옵션)
- tournaments/{tournamentId}/divisions/{divisionId}/events/{eventId}/scores (게임 점수)
- tournaments/{tournamentId}/divisions/{divisionId}/events/{eventId}/assignments (게임/레인 배정)

## 실시간 업데이트
- 점수 입력은 transaction 또는 batched write로 저장
- 점수표는 정렬 기준 정해진 쿼리 + 캐시로 즉시 표시
- 실시간 반영이 필요한 화면은 Firestore `onSnapshot` 사용

## 핵심 도메인 규칙
- 대회별 데이터 분리: 모든 쿼리는 tournamentId를 포함해야 함
- 선수번호 자동 배정: 대회 내에서 고유 증가
- 점수는 게임 총점만 저장 (프레임 단위 미보관)
- Table 이동수 적용: 게임 종료 시 다음 게임 배정에 자동 반영
- 정렬 우선순위: 합계 > 평균 > 핀차이

## 기술 스택 확정(2차 버전)
- TypeScript + Next.js 14
- Firebase SDK + Firebase Admin
- Tailwind 또는 CSS Module (차후 확정)
- UI state: React Context + Server Actions (초기엔 로컬 훅)

## 비기능 요구
- 대회 조회 응답시간: 2초 이내
- 대시보드 검색 500ms debounce
- 게임 점수 저장 후 1초 내 랭킹 반영(목표)
