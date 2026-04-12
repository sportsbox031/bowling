import { getFirstHalfGameNumbers, isFivesEventConfig, normalizeFivesPhaseSplit } from "@/lib/fives-config";

type FivesEventWindowInput = {
  gameCount?: unknown;
  fivesConfig?: unknown;
};

type FivesTeamWindowInput = {
  firstHalfMemberIds?: unknown;
  memberIds?: unknown;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))]
    : [];

export const isFivesSubstitutionWindowOpen = (
  event: FivesEventWindowInput,
  team: FivesTeamWindowInput,
  scoreKeys: Set<string>,
) => {
  const firstHalfMemberIds = toStringArray(team.firstHalfMemberIds ?? team.memberIds ?? []);
  if (firstHalfMemberIds.length === 0) {
    return false;
  }

  const config = isFivesEventConfig(event.fivesConfig)
    ? event.fivesConfig
    : normalizeFivesPhaseSplit({ gameCount: Number(event.gameCount ?? 0) });
  const firstHalfGameNumbers = getFirstHalfGameNumbers(config);
  if (firstHalfGameNumbers.length === 0) {
    return false;
  }

  return firstHalfMemberIds.every((playerId) =>
    firstHalfGameNumbers.every((gameNumber) => scoreKeys.has(`${playerId}:${gameNumber}`)),
  );
};
