# Firestore 데이터 모델

## 1) tournaments
| 필드 | 타입 | 설명 |
|---|---|---|
| title | string | 대회명 |
| host | string | 주최 |
| seasonYear | number | 연도 |
| region | string | 지역 |
| startsAt | timestamp(string) | 시작일 |
| endsAt | timestamp(string) | 종료일 |
| laneStart | number | 사용 레인 시작 |
| laneEnd | number | 사용 레인 끝 |
| status | string | UPCOMING / ONGOING / FINISHED |
| createdAt | timestamp |
| updatedAt | timestamp |

예시 경로: `tournaments/{tournamentId}`

## 2) divisions (subcollection)
`tournaments/{tournamentId}/divisions/{divisionId}`

| 필드 | 타입 | 설명 |
|---|---|---|
| code | string | 부문 코드 |
| title | string | "초등부 U-10 남자" |
| ageLabel | string | "U-10" |
| gender | string | M/F/MIXED |

## 3) events (subcollection)
`tournaments/{tournamentId}/divisions/{divisionId}/events/{eventId}`

| 필드 | 타입 | 설명 |
|---|---|---|
| title | string | 개인전/2인조... |
| kind | string | SINGLE, DOUBLES, ... |
| gameCount | number | 최대 6 |
| scheduleDate | timestamp |
| laneStart | number | 세부종목별 레인 시작 |
| laneEnd | number | 세부종목별 레인 끝 |
| tableShift | number | 예: 2, -2 |

## 4) players
`tournaments/{tournamentId}/players/{playerId}`

| 필드 | 타입 | 설명 |
|---|---|---|
| divisionId | string | 소속 종별 |
| group | string | A / B |
| region | string | 시군 |
| affiliation | string | 소속(학교) |
| number | number | 대회 내 선수번호(자동) |
| name | string | 성명 |
| hand | string | left/right |

## 5) scores
추천 1: `tournaments/{tournamentId}/divisions/{divisionId}/events/{eventId}/scores/{scoreId}`

| 필드 | 타입 | 설명 |
|---|---|---|
| playerId | string | 선수 |
| eventId | string | 세부종목 |
| gameNumber | number | 1~6 |
| laneNumber | number | 당시 레인 |
| score | number | 게임 총점 |
| createdAt | timestamp | |

## 6) assignments
추천 1: `tournaments/{tournamentId}/divisions/{divisionId}/events/{eventId}/assignments/{assignmentId}`

| 필드 | 타입 | 설명 |
|---|---|---|
| playerId | string | 선수 |
| gameNumber | number | 게임 번호 |
| laneNumber | number | 배정 레인 |

## 7) 인덱스 제안
- players: `tournamentId + divisionId`
- scores: `eventId + gameNumber + score` 또는 조회 패턴에 맞춰 복합 인덱스
- assignments: `eventId + gameNumber + laneNumber`

## 8) 데이터 격리 원칙
- 모든 조회/쓰기 연산은 tournamentId를 필수 조건으로 제한
- 관리자/일반 사용자 페이지에서 읽기 경로가 달라져도 같은 문서 경로를 재사용
