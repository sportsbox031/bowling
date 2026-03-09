export const parseParticipantNumberInput = (input: string): number[] | null => {
  const normalized = input.trim();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    const value = Number(normalized);
    return value > 0 ? [value] : null;
  }

  const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!rangeMatch) return null;

  const start = Number(rangeMatch[1]);
  const end = Number(rangeMatch[2]);
  if (start <= 0 || end <= 0 || start > end) return null;

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};
