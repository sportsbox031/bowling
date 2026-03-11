export const applySavedDraftEntries = (
  dirtyPlayerIds: Set<string>,
  savedPlayerIds: string[],
): Set<string> => {
  const next = new Set(dirtyPlayerIds);
  for (const playerId of savedPlayerIds) {
    next.delete(playerId);
  }
  return next;
};
