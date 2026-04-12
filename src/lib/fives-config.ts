import type { FivesEventConfig } from "@/lib/models";

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

export const normalizeFivesPhaseSplit = (input: { gameCount: number }): FivesEventConfig => {
  const gameCount = Number(input.gameCount);

  if (gameCount === 4) {
    return { firstHalfGameCount: 2, secondHalfGameCount: 2 };
  }

  if (gameCount === 6) {
    return { firstHalfGameCount: 3, secondHalfGameCount: 3 };
  }

  const firstHalfGameCount = Math.max(1, Math.floor(gameCount / 2));
  return {
    firstHalfGameCount,
    secondHalfGameCount: Math.max(0, gameCount - firstHalfGameCount),
  };
};

export const isFivesEventConfig = (value: unknown): value is FivesEventConfig => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<FivesEventConfig>;
  return isPositiveInteger(candidate.firstHalfGameCount) && isPositiveInteger(candidate.secondHalfGameCount);
};

export const getFirstHalfGameNumbers = (config: FivesEventConfig): number[] =>
  Array.from({ length: config.firstHalfGameCount }, (_, index) => index + 1);

export const getSecondHalfGameNumbers = (config: FivesEventConfig): number[] =>
  Array.from({ length: config.secondHalfGameCount }, (_, index) => config.firstHalfGameCount + index + 1);

export const getHalfForGameNumber = (config: FivesEventConfig, gameNumber: number): "FIRST" | "SECOND" | null => {
  if (!Number.isInteger(gameNumber) || gameNumber < 1) return null;
  if (gameNumber <= config.firstHalfGameCount) return "FIRST";
  if (gameNumber <= config.firstHalfGameCount + config.secondHalfGameCount) return "SECOND";
  return null;
};
