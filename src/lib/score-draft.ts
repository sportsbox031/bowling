const PREFIX = "score-draft:";

export const readScoreDraft = (key: string): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const writeScoreDraft = (key: string, value: Record<string, string>) => {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(value).filter(([, draft]) => draft !== "");
    if (entries.length === 0) {
      window.localStorage.removeItem(`${PREFIX}${key}`);
      return;
    }
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore storage errors.
  }
};

export const clearScoreDraft = (key: string, playerIds?: string[]) => {
  if (typeof window === "undefined") return;
  try {
    if (!playerIds || playerIds.length === 0) {
      window.localStorage.removeItem(`${PREFIX}${key}`);
      return;
    }
    const current = readScoreDraft(key);
    for (const playerId of playerIds) {
      delete current[playerId];
    }
    writeScoreDraft(key, current);
  } catch {
    // Ignore storage errors.
  }
};
