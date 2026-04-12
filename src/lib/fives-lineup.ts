import type { FivesEventConfig, FivesLineups, HalfType } from "@/lib/models";
import { getHalfForGameNumber } from "@/lib/fives-config";

type NormalizeLineupInput = {
  rosterIds: string[];
  firstHalfMemberIds?: string[];
  secondHalfMemberIds?: string[];
};

export type NormalizedFivesLineups = FivesLineups & {
  rosterIds: string[];
};

const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))];

export const isLineupComplete = (memberIds: string[], teamSize: number): boolean =>
  unique(memberIds).length === teamSize;

export const normalizeFivesLineups = (input: NormalizeLineupInput): NormalizedFivesLineups => {
  const rosterIds = unique(input.rosterIds);
  const firstHalfMemberIds = unique(input.firstHalfMemberIds ?? []).filter((id) => rosterIds.includes(id));
  const normalizedFirstHalf = firstHalfMemberIds.length > 0 ? firstHalfMemberIds : rosterIds.slice(0, 5);
  const secondHalfMemberIds = unique(input.secondHalfMemberIds ?? []).filter((id) => rosterIds.includes(id));

  return {
    rosterIds,
    firstHalfMemberIds: normalizedFirstHalf,
    secondHalfMemberIds: secondHalfMemberIds.length > 0 ? secondHalfMemberIds : normalizedFirstHalf,
  };
};

export const getLineupForHalf = (lineups: FivesLineups, halfType: HalfType): string[] =>
  halfType === "FIRST" ? lineups.firstHalfMemberIds : lineups.secondHalfMemberIds;

export const getLineupForGameNumber = (
  lineups: FivesLineups,
  config: FivesEventConfig,
  gameNumber: number,
): string[] => {
  const half = getHalfForGameNumber(config, gameNumber);
  if (!half) return [];
  return getLineupForHalf(lineups, half);
};

export const getBenchPlayerIdsForHalf = (lineups: NormalizedFivesLineups, halfType: HalfType): string[] => {
  const active = new Set(getLineupForHalf(lineups, halfType));
  return lineups.rosterIds.filter((playerId) => !active.has(playerId));
};
