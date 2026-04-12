import { getLineupForGameNumber, normalizeFivesLineups } from "@/lib/fives-lineup";
import { isFivesEventConfig, normalizeFivesPhaseSplit } from "@/lib/fives-config";
import type { FivesEventConfig } from "@/lib/models";

type TeamLineupInput = {
  memberIds: string[];
  rosterIds?: string[];
  firstHalfMemberIds?: string[];
  secondHalfMemberIds?: string[];
};

type TeamLineupContext = {
  kind?: string | null;
  gameNumber: number;
  gameCount?: number;
  fivesConfig?: FivesEventConfig | null;
};

const uniqueIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

export const getTeamRosterIds = (team: TeamLineupInput): string[] => {
  if (Array.isArray(team.rosterIds) && team.rosterIds.length > 0) {
    return uniqueIds(team.rosterIds);
  }

  return uniqueIds([
    ...team.memberIds,
    ...(team.firstHalfMemberIds ?? []),
    ...(team.secondHalfMemberIds ?? []),
  ]);
};

export const getTeamActiveMemberIdsForGame = (
  team: TeamLineupInput,
  context: TeamLineupContext,
): string[] => {
  if (context.kind !== "FIVES") {
    return uniqueIds(team.memberIds);
  }

  const gameCount = Number(context.gameCount ?? 0);
  const config = isFivesEventConfig(context.fivesConfig)
    ? context.fivesConfig
    : normalizeFivesPhaseSplit({ gameCount });

  const normalized = normalizeFivesLineups({
    rosterIds: getTeamRosterIds(team),
    firstHalfMemberIds: team.firstHalfMemberIds ?? team.memberIds,
    secondHalfMemberIds: team.secondHalfMemberIds ?? team.firstHalfMemberIds ?? team.memberIds,
  });

  return uniqueIds(getLineupForGameNumber(normalized, config, context.gameNumber));
};

export const getTeamBenchMemberIdsForGame = (
  team: TeamLineupInput,
  context: TeamLineupContext,
): string[] => {
  const rosterIds = getTeamRosterIds(team);
  const activeIds = new Set(getTeamActiveMemberIdsForGame(team, context));
  return rosterIds.filter((playerId) => !activeIds.has(playerId));
};
