export type Hand = "left" | "right";

export type EventType = "SINGLE" | "DOUBLES" | "TRIPLES" | "FOURS" | "FIVES" | "OVERALL";

export type GenderCategory = "M" | "F" | "MIXED";

export interface TeamGroup {
  id: string;
  label: string;
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
}

export interface Player {
  id: string;
  tournamentId: string;
  divisionId: string;
  group: string;
  region: string;
  affiliation: string;
  number: number;
  name: string;
  hand: Hand;
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
  createdAt: string;
}

export interface ScoreColumn {
  gameNumber: number;
  score: number | null;
}

export interface EventRankingRow {
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
}
