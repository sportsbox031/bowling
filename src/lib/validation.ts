import { MAX_GAME_COUNT } from "@/lib/scoring";

const FIRESTORE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const DEFAULT_SANITIZED_STRING_MAX_LENGTH = 200;

export const isValidFirestoreId = (id: string): boolean =>
  FIRESTORE_ID_PATTERN.test(id);

export const isValidScore = (score: number): boolean =>
  Number.isInteger(score) && score >= 0 && score <= 300;

export const isValidGameNumber = (gameNumber: number): boolean =>
  Number.isInteger(gameNumber) && gameNumber >= 1 && gameNumber <= MAX_GAME_COUNT;

export const isValidPaginationLimit = (limit: number): boolean =>
  Number.isInteger(limit) && limit >= 1 && limit <= 100;

export const sanitizeString = (
  str: string,
  maxLength = DEFAULT_SANITIZED_STRING_MAX_LENGTH,
): string => str.trim().replace(/\0/g, "").slice(0, maxLength);

export const validateRequiredFields = <T extends Record<string, unknown>>(
  body: T,
  fields: string[],
): { valid: boolean; missing: string[] } => {
  const missing = fields.filter((field) => body[field] == null);

  return {
    valid: missing.length === 0,
    missing,
  };
};
