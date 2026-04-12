type TeamLike = {
  entryGroup?: "A" | "B" | null;
};

const uniqueNumbers = (values: number[]) => [...new Set(values)];

export const parseTeamPlayerNumberInput = (input: string): number[] | null => {
  const text = input.trim();
  if (!text) {
    return [];
  }

  const tokens = text.split(",").map((token) => token.trim()).filter(Boolean);
  const numbers: number[] = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      numbers.push(Number(token));
      continue;
    }

    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end) {
        return null;
      }
      for (let current = start; current <= end; current += 1) {
        numbers.push(current);
      }
      continue;
    }

    return null;
  }

  return uniqueNumbers(numbers);
};

export const buildAutoTeamNames = (organizationName: string, teams: TeamLike[]): string[] => {
  const baseName = organizationName.trim();
  const groupCounts = new Map<string, number>();

  return teams.map((team) => {
    const entryGroup = team.entryGroup === "B" ? "B" : "A";
    const key = `${baseName}${entryGroup}`;
    const nextCount = (groupCounts.get(key) ?? 0) + 1;
    groupCounts.set(key, nextCount);

    return nextCount === 1
      ? `${baseName}${entryGroup}조`
      : `${baseName}${entryGroup}조 ${nextCount}팀`;
  });
};
