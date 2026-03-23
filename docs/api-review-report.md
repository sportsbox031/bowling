# API 보안 및 Firebase 읽기 최적화 리뷰 보고서

> 작성일: 2026-03-21

---

## 1. 보안 수정 사항

| 분류 | 대상 라우트 | 변경 내용 |
|------|------------|----------|
| **레이트 리밋** | 공개 API 8개 전체 | `publicRateLimiter.check()` 추가 + 모든 응답 경로(캐시 히트, 집계 히트, 재빌드)에 `X-RateLimit-Remaining` 헤더 반환 |
| **에러 메시지 노출 방지** | scoreboard, assignments, admin score, admin events, admin assignments | 500 응답에서 `error: String(error)` 제거 — 내부 스택 트레이스 외부 노출 차단 |
| **입력값 검증 중앙화** | admin score 라우트 | 게임 번호(`1~6`), 점수(`0~300`) 매직 넘버 인라인 검증을 `@/lib/validation`의 `isValidGameNumber()` / `isValidScore()` 함수로 교체 |
| **divisionId 필수화** | public scoreboard, assignments | `divisionId` 없을 경우 비싼 `resolveEventRef()` 스캔 대신 400 `DIVISION_ID_REQUIRED` 즉시 반환 |

---

## 2. Firebase 읽기 횟수 최적화

| 라우트 | 변경 전 (요청당 읽기) | 변경 후 (요청당 읽기) | 절감 효과 |
|--------|---------------------|---------------------|----------|
| **`/api/public/scoreboard`** | eventDoc.get() + 집계 읽기 (최소 2회) | 집계 우선 읽기 → 저장된 경우 1회, 재빌드 경로에서만 eventDoc 조회 | **웜 패스 기준 약 50% 감소** |
| **`/api/public/assignments`** | assignments + players + squads 3개 컬렉션 병렬 쿼리 (N+M+K회) | 집계 문서 단일 읽기 → 저장된 경우 1회 | **약 90% 감소 — 가장 큰 개선** |
| **`/api/public/tournaments/[id]`** | 이미 집계 패턴 적용됨 | 레이트 리밋으로 전체 요청량 간접 절감 | 간접 절감 |
| **`/api/public/players/profile`** | 이미 집계 패턴 적용됨 | 레이트 리밋으로 전체 요청량 간접 절감 | 간접 절감 |

### 핵심 패턴 변경 — scoreboard 라우트

기존 흐름:
```
캐시 확인 → eventDoc.get() (1회 읽기) → 집계 읽기 → 결과 반환
```

변경 후 흐름:
```
캐시 확인 → 집계 읽기 → 결과 있으면 즉시 반환 (1회 읽기)
           ↓ (집계 없을 때만)
           eventDoc.get() → 재빌드 → 결과 반환
```

집계가 있는 경우(대부분의 요청) eventDoc 조회를 완전히 건너뜀.

---

## 3. 일일 읽기 횟수 예상 절감 (Firebase Spark 플랜 — 일 50,000 제한)

하루 약 1,000건 페이지뷰 + 폴링 기준:

| 시나리오 | 변경 전 (예상 읽기) | 변경 후 (예상 읽기) |
|---------|-------------------|-------------------|
| 스코어보드 뷰 (500건, 캐시 히트율 60%) | ~400회 | ~200회 |
| 레인 배정 뷰 (300건, 캐시 히트율 50%) | ~450회+ (쿼리 3개) | ~150회 |
| 기타 공개 라우트 | ~300회 | ~300회 (레이트 리밋) |
| **합계** | **~1,150회+** | **~650회** |

assignments 라우트 리팩터링이 단일 항목으로 가장 큰 개선 — 컬렉션 3회 쿼리 → 집계 문서 1회 읽기.

---

## 4. 추가 권장 사항 (미적용)

- **어드민 라우트 레이트 리밋**: 세션 인증으로 보호되어 우선순위 낮음. 관리자 어뷰징이 우려될 경우 추가 검토.
- **`resolveEventRef()` 잔존 사용**: 일부 어드민 라우트에서 여전히 사용 중. 어드민 UI에서도 `divisionId`를 함께 전달하도록 개선하면 해당 디비전 스캔 제거 가능.
- **집계 데이터 최신성**: 집계가 오래된 경우, 점수 저장 시점에 백그라운드 재빌드 트리거를 추가하면 공개 읽기 경로에서 온디맨드 재빌드를 줄일 수 있음.

---

## 5. 변경된 파일 목록

```
src/app/api/admin/score/route.ts                                         (입력값 검증, 에러 노출 방지)
src/app/api/admin/tournaments/[tournamentId]/divisions/.../assignments/route.ts  (에러 노출 방지)
src/app/api/admin/tournaments/[tournamentId]/divisions/.../events/[eventId]/route.ts  (에러 노출 방지)
src/app/api/admin/tournaments/[tournamentId]/route.ts                    (에러 노출 방지)
src/app/api/public/assignments/route.ts                                  (레이트 리밋, 집계 패턴, divisionId 필수화)
src/app/api/public/players/profile/route.ts                              (레이트 리밋)
src/app/api/public/players/rankings/route.ts                             (레이트 리밋)
src/app/api/public/players/search/route.ts                               (레이트 리밋)
src/app/api/public/scoreboard/overall/route.ts                           (레이트 리밋)
src/app/api/public/scoreboard/route.ts                                   (레이트 리밋, 집계 우선 읽기, divisionId 필수화)
src/app/api/public/tournaments/[tournamentId]/route.ts                   (레이트 리밋)
src/app/api/public/tournaments/route.ts                                  (레이트 리밋)
package.json / package-lock.json                                         (의존성 업데이트)
```

총 13개 소스 파일. `npm run build` (TypeScript strict mode) 정상 통과 확인.
