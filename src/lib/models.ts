export type Hand = "left" | "right";

export type EventType = "SINGLE" | "DOUBLES" | "TRIPLES" | "FOURS" | "FIVES" | "OVERALL";

export type GenderCategory = "M" | "F" | "MIXED";

export type TeamType = "NORMAL" | "MAKEUP" | "PARTIAL";

export type HalfType = "FIRST" | "SECOND";

export interface FivesEventConfig {
  firstHalfGameCount: number;
  secondHalfGameCount: number;
}

export interface FivesLineups {
  firstHalfMemberIds: string[];
  secondHalfMemberIds: string[];
}

/** 팀 게임(2인조/3인조/5인조) 팀 구성 */
export interface Team {
  id: string;
  tournamentId: string;
  divisionId: string;
  eventId: string;
  name: string;           // NORMAL: 소속명, MAKEUP/PARTIAL: 표시용 이름
  teamType: TeamType;     // 소속 동일 정상팀 = NORMAL, 혼성 = MAKEUP, 미완성팀 = PARTIAL
  memberIds: string[];    // 출전 선수 ID 목록 (순서 있음)
  rosterIds?: string[];   // 5인조 전용: 교체 가능 전체 로스터
  firstHalfMemberIds?: string[]; // 5인조 단일 이벤트 전반 라인업
  secondHalfMemberIds?: string[]; // 5인조 단일 이벤트 후반 라인업
  linkedTeamId?: string;  // 5인조 후반전이 전반전 팀을 참조할 때 사용
  createdAt: string;
  updatedAt: string;
}

export interface Tournament {
  id: string;
  title: string;
  host: string;
  seasonYear: number;
  region: string;
  laneStart: number;
  laneEnd: number;
  status: "UPCOMING" | "ONGOING" | "FINISHED";
  createdAt: string;
  updatedAt: string;
  startsAt: string;
  endsAt: string;
  coverImageUrl?: string;
}

export interface Division {
  id: string;
  tournamentId: string;
  code: string;
  title: string; // 예: 초등부 U-10 남자
  ageLabel: string; // 예: U-10
  gender: GenderCategory;
  createdAt: string;
  updatedAt: string;
}

export interface EventSpec {
  id: string;
  tournamentId: string;
  divisionId: string;
  title: string; // 예: 개인전, 2인조
  kind: EventType;
  gameCount: number; // 최대 6
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number; // 예: +2, -2
  createdAt: string;
  updatedAt: string;
  // 팀 게임 전용 (DOUBLES/TRIPLES/FIVES)
  teamSize?: number;          // 2, 3, 5
  fivesConfig?: FivesEventConfig; // 5인조 단일 이벤트 전/후반 설정
  linkedEventId?: string;     // 5인조 전반↔후반 연결
  halfType?: HalfType;        // 5인조 전반/후반 구분
}

export interface Player {
  id: string;
  shortId?: string; // 글로벌 고유 ID (예: "P0001") — 마이그레이션 전 데이터는 없을 수 있음
  tournamentId: string;
  divisionId: string;
  organizationId?: string;
  entryGroup?: "A" | "B";
  submittedBy?: string;
  playerRegistrationSubmissionId?: string;
  group: string;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  hand: Hand;
  createdAt: string;
}

/** 글로벌 선수 레지스트리 — 동명이인 구분용 */
export interface GlobalPlayer {
  shortId: string;
  name: string;
  region: string;
  affiliation: string;
  createdAt: string;
}

export interface ScoreRow {
  id: string;
  tournamentId: string;
  eventId: string;
  playerId: string;
  gameNumber: number; // 1~6
  laneNumber: number;
  score: number;
  createdAt: string;
}

export interface GameAssignment {
  id: string;
  tournamentId: string;
  eventId: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  position?: number;
  createdAt: string;
}

export interface ScoreColumn {
  gameNumber: number;
  score: number | null;
}

export interface TeamMemberRow {
  playerId: string;
  name: string;
  affiliation: string;
  region: string;
  number: number;
  gameScores: ScoreColumn[];
  total: number;
  average?: number;
  playsFirstHalf?: boolean;
  playsSecondHalf?: boolean;
}

export interface TeamRankingRow {
  teamId: string;
  teamName: string;
  teamType: TeamType;
  linkedTeamId?: string;
  rank: number;
  tieRank: number;
  members: TeamMemberRow[];
  teamGameTotals?: Array<number | null>;
  teamTotal: number;  // MAKEUP/PARTIAL = 0 (미합산)
  pinDiff: number;
}

export interface EventRankingRow {
  playerId: string;
  rank: number;
  tieRank: number;
  attempts: number;
  region: string;
  affiliation: string;
  group?: string;
  number: number;
  name: string;
  gameScores: ScoreColumn[];
  total: number;
  average: number;
  pinDiff: number;
}

export interface OverallRankingRow {
  playerId: string;
  rank: number;
  tieRank: number;
  attempts: number;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  gameScores: ScoreColumn[];
  total: number;
  average: number;
  pinDiff: number;
  gameCount: number;
  eventTotals?: Record<string, number>;
}


