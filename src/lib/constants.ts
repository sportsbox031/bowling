import { CSSProperties } from "react";

export const KIND_LABELS: Record<string, string> = {
  SINGLE: "개인전",
  DOUBLES: "2인조",
  TRIPLES: "3인조",
  FOURS: "4인조",
  FIVES: "5인조",
  OVERALL: "개인종합",
};

export const GENDER_LABELS: Record<string, string> = {
  M: "남자",
  F: "여자",
  MIXED: "혼합",
};

export const TOURNAMENT_STATUS_LABELS: Record<
  string,
  { label: string; variant: "success" | "default" | "info" }
> = {
  ONGOING: { label: "진행중", variant: "success" },
  FINISHED: { label: "종료", variant: "default" },
  UPCOMING: { label: "예정", variant: "info" },
};

export const getRankTextStyle = (rank: number): CSSProperties => {
  if (rank === 1) return { color: "#f59e0b", fontWeight: 800, fontSize: 15 };
  if (rank === 2) return { color: "#6366f1", fontWeight: 700 };
  if (rank === 3) return { color: "#8b5cf6", fontWeight: 600 };
  return {};
};

export const formatDivisionLabel = (title: string, gender?: string) => {
  const genderLabel = GENDER_LABELS[gender ?? ""] ?? "";
  return genderLabel ? `${title} ${genderLabel}` : title;
};
