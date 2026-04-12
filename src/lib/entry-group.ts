import type { EntryGroup } from "@/lib/models-user";

export const ENTRY_GROUP_A_LIMIT = 6;

export const getEntryGroupForOrder = (order: number): EntryGroup =>
  order >= 1 && order <= ENTRY_GROUP_A_LIMIT ? "A" : "B";

export const assignEntryGroups = <T>(items: T[]): Array<T & { entryGroup: EntryGroup; entryOrder: number }> =>
  items.map((item, index) => ({
    ...item,
    entryOrder: index + 1,
    entryGroup: getEntryGroupForOrder(index + 1),
  }));
