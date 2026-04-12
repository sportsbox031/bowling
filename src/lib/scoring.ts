import {
  EventRankingRow,
  FivesEventConfig,
  OverallRankingRow,
  Player,
  ScoreColumn,
  ScoreRow,
  Team,
  TeamMemberRow,
  TeamRankingRow,
} from "./models";

export const MAX_GAME_COUNT = 6;

export interface EventRankingInput {
  players: Player[];
  scores: ScoreRow[];
  gameCount: number;
}

export interface EventRankingResult {
  rows: EventRankingRow[];
}

export interface OverallRankingInput {
  playerIds: string[];
  eventRowsByEventId: Record<string, EventRankingRow[]>;
}

export interface OverallRankingResult {
  rows: OverallRankingRow[];
}

const normalizeGameCount = (gameCount: number): number => {
  if (!Number.isFinite(gameCount)) {
    return 1;
  }

  return Math.min(MAX_GAME_COUNT, Math.max(1, Math.floor(gameCount)));
};

const emptyScoreColumns = (count = MAX_GAME_COUNT): ScoreColumn[] =>
  Array.from({ length: count }, (_, index) => ({
    gameNumber: index + 1,
    score: null,
  }));

const roundToOneDecimal = (value: number): number =>
  Math.round((value + Number.EPSILON) * 10) / 10;

const mergeMemberIds = (...groups: Array<string[] | undefined>): string[] => {
  const merged: string[] = [];
  groups.forEach((group) => {
    (group ?? []).forEach((playerId) => {
      if (playerId && !merged.includes(playerId)) {
        merged.push(playerId);
      }
    });
  });
  return merged;
};

const compareRows = (
  a: Omit<EventRankingRow, "rank" | "tieRank">,
  b: Omit<EventRankingRow, "rank" | "tieRank">,
): number => {
  if (b.total !== a.total) {
    return b.total - a.total;
  }
  if (b.average !== a.average) {
    return b.average - a.average;
  }
  return a.pinDiff - b.pinDiff;
};

const getOverallGameColumnCount = (eventRowsByEventId: Record<string, EventRankingRow[]>): number => {
  let maxColumnCount = 1;

  for (const eventRows of Object.values(eventRowsByEventId)) {
    for (const row of eventRows) {
      maxColumnCount = Math.max(maxColumnCount, row.gameScores.length);
    }
  }

  return maxColumnCount;
};

export const buildEventLeaderboard = (input: EventRankingInput): EventRankingResult => {
  const gameCount = normalizeGameCount(input.gameCount);
  const scoreMap = new Map<string, ScoreRow[]>();

  for (const score of input.scores) {
    const list = scoreMap.get(score.playerId);
    if (list) {
      list.push(score);
    } else {
      scoreMap.set(score.playerId, [score]);
    }
  }

  const baseRows: Omit<EventRankingRow, "rank" | "tieRank">[] = input.players.map((player) => {
    const playerScores = scoreMap.get(player.id) ?? [];
    const games = emptyScoreColumns(gameCount);
    let total = 0;
    let attempts = 0;

    for (const row of playerScores) {
      if (row.gameNumber < 1 || row.gameNumber > gameCount) {
        continue;
      }

      games[row.gameNumber - 1].score = row.score;
      total += row.score;
      attempts += 1;
    }

    const average = attempts > 0 ? roundToOneDecimal(total / attempts) : 0;

    return {
      playerId: player.id,
      attempts,
      region: player.region,
      affiliation: player.affiliation,
      group: player.group ?? "",
      number: player.number,
      name: player.name,
      gameScores: games,
      total,
      average,
      pinDiff: 0,
    };
  });

  const sorted = [...baseRows].sort(compareRows);
  const leaderTotal = sorted[0]?.total ?? 0;
  const leaderByScore = new Map<number, number>();

  sorted.forEach((row, idx) => {
    if (!leaderByScore.has(row.total)) {
      leaderByScore.set(row.total, idx + 1);
    }
  });

  const finalRows: EventRankingRow[] = sorted.map((row) => ({
    ...row,
    rank: leaderByScore.get(row.total) ?? 0,
    tieRank: leaderByScore.get(row.total) ?? 0,
    pinDiff: Math.max(0, leaderTotal - row.total),
  }));

  return { rows: finalRows };
}

export interface TeamRankingInput {
  teams: Team[];
  playerMap: Map<string, Player>;
  individualRows: EventRankingRow[];
}

export interface TeamRankingResult {
  rows: TeamRankingRow[];
}

const rankTeamRows = (
  rows: Omit<TeamRankingRow, "rank" | "tieRank" | "pinDiff">[],
): TeamRankingRow[] => {
  const normalRows = rows.filter((r) => r.teamType === "NORMAL");
  const unrankedRows = rows.filter((r) => r.teamType !== "NORMAL");

  const sortedNormal = [...normalRows].sort((a, b) => b.teamTotal - a.teamTotal);
  const leaderTotal = sortedNormal[0]?.teamTotal ?? 0;

  const rankMap = new Map<number, number>();
  sortedNormal.forEach((row, idx) => {
    if (!rankMap.has(row.teamTotal)) {
      rankMap.set(row.teamTotal, idx + 1);
    }
  });

  const rankedNormal: TeamRankingRow[] = sortedNormal.map((row) => ({
    ...row,
    rank: rankMap.get(row.teamTotal) ?? 0,
    tieRank: rankMap.get(row.teamTotal) ?? 0,
    pinDiff: Math.max(0, leaderTotal - row.teamTotal),
  }));

  const trailingRows: TeamRankingRow[] = unrankedRows.map((row) => ({
    ...row,
    rank: 0,
    tieRank: 0,
    pinDiff: 0,
  }));

  return [...rankedNormal, ...trailingRows];
};

export const buildTeamLeaderboard = (input: TeamRankingInput): TeamRankingResult => {
  const individualByPlayer = new Map<string, EventRankingRow>();
  for (const row of input.individualRows) {
    individualByPlayer.set(row.playerId, row);
  }

  const baseRows: Omit<TeamRankingRow, "rank" | "tieRank" | "pinDiff">[] = input.teams.map((team) => {
    const members: TeamMemberRow[] = team.memberIds.map((pid) => {
      const player = input.playerMap.get(pid);
      const row = individualByPlayer.get(pid);
      return {
        playerId: pid,
        name: player?.name ?? "",
        affiliation: player?.affiliation ?? "",
        region: player?.region ?? "",
        number: player?.number ?? 0,
        gameScores: row?.gameScores ?? [],
        total: row?.total ?? 0,
      };
    });

    const teamTotal = team.teamType === "NORMAL"
      ? members.reduce((sum, m) => sum + m.total, 0)
      : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      teamType: team.teamType,
      members,
      teamTotal,
      ...(team.linkedTeamId ? { linkedTeamId: team.linkedTeamId } : {}),
    };
  });

  return { rows: rankTeamRows(baseRows) };
};

export interface FivesTeamRankingInput extends TeamRankingInput {
  fivesConfig: FivesEventConfig;
}

const sumScoresForGames = (row: EventRankingRow | undefined, gameNumbers: number[]): number =>
  gameNumbers.reduce((sum, gameNumber) => {
    const score = row?.gameScores?.[gameNumber - 1]?.score;
    return sum + (typeof score === "number" ? score : 0);
  }, 0);

export const buildFivesTeamLeaderboard = (input: FivesTeamRankingInput): TeamRankingResult => {
  const individualByPlayer = new Map<string, EventRankingRow>();
  for (const row of input.individualRows) {
    individualByPlayer.set(row.playerId, row);
  }

  const firstHalfGames = Array.from({ length: input.fivesConfig.firstHalfGameCount }, (_, index) => index + 1);
  const secondHalfGames = Array.from(
    { length: input.fivesConfig.secondHalfGameCount },
    (_, index) => input.fivesConfig.firstHalfGameCount + index + 1,
  );

  const baseRows: Omit<TeamRankingRow, "rank" | "tieRank" | "pinDiff">[] = input.teams.map((team) => {
    const firstHalfMemberIds = team.firstHalfMemberIds ?? team.memberIds;
    const secondHalfMemberIds = team.secondHalfMemberIds ?? team.firstHalfMemberIds ?? team.memberIds;
    const displayMemberIds = mergeMemberIds(
      firstHalfMemberIds,
      secondHalfMemberIds,
      team.rosterIds,
    );
    const members: TeamMemberRow[] = displayMemberIds.map((pid) => {
      const player = input.playerMap.get(pid);
      const row = individualByPlayer.get(pid);
      return {
        playerId: pid,
        name: player?.name ?? "",
        affiliation: player?.affiliation ?? "",
        region: player?.region ?? "",
        number: player?.number ?? 0,
        gameScores: row?.gameScores ?? [],
        total: row?.total ?? 0,
        average: row?.attempts ? roundToOneDecimal((row?.total ?? 0) / row.attempts) : 0,
        playsFirstHalf: firstHalfMemberIds.includes(pid),
        playsSecondHalf: secondHalfMemberIds.includes(pid),
      };
    });

    const firstHalfTotal = firstHalfMemberIds.reduce(
      (sum, playerId) => sum + sumScoresForGames(individualByPlayer.get(playerId), firstHalfGames),
      0,
    );
    const secondHalfTotal = secondHalfMemberIds.reduce(
      (sum, playerId) => sum + sumScoresForGames(individualByPlayer.get(playerId), secondHalfGames),
      0,
    );
    const teamGameTotals = [...firstHalfGames, ...secondHalfGames].map((gameNumber) => {
      const activeMemberIds = firstHalfGames.includes(gameNumber) ? firstHalfMemberIds : secondHalfMemberIds;
      const gameTotal = activeMemberIds.reduce((sum, playerId) => {
        const score = individualByPlayer.get(playerId)?.gameScores?.[gameNumber - 1]?.score;
        return sum + (typeof score === "number" ? score : 0);
      }, 0);
      return activeMemberIds.length > 0 ? gameTotal : null;
    });

    return {
      teamId: team.id,
      teamName: team.name,
      teamType: team.teamType,
      members,
      teamGameTotals,
      teamTotal: team.teamType === "NORMAL" ? firstHalfTotal + secondHalfTotal : 0,
      ...(team.linkedTeamId ? { linkedTeamId: team.linkedTeamId } : {}),
    };
  });

  return { rows: rankTeamRows(baseRows) };
};

export interface FivesLinkedInput {
  firstHalfRows: TeamRankingRow[];
  secondHalfRows: TeamRankingRow[];
}

export interface FivesLinkedResult {
  rows: TeamRankingRow[];
}

/**
 * 5인조 전반+후반 팀점수 합산 리더보드.
 * 전반/후반 팀을 teamName으로 매칭합니다.
 */
export const buildFivesLinkedLeaderboard = (input: FivesLinkedInput): FivesLinkedResult => {
  const secondHalfByKey = new Map<string, TeamRankingRow>();
  for (const row of input.secondHalfRows) {
    if (row.teamType === "NORMAL") {
      if (row.linkedTeamId) {
        secondHalfByKey.set(`linked:${row.linkedTeamId}`, row);
      }
      secondHalfByKey.set(`name:${row.teamName}`, row);
    }
  }

  const combined: TeamRankingRow[] = [];

  for (const firstRow of input.firstHalfRows) {
    if (firstRow.teamType !== "NORMAL") {
      continue;
    }
    const secondRow = secondHalfByKey.get(`linked:${firstRow.teamId}`)
      ?? secondHalfByKey.get(`name:${firstRow.teamName}`);
    const secondTotal = secondRow?.teamTotal ?? 0;
    combined.push({
      ...firstRow,
      teamTotal: firstRow.teamTotal + secondTotal,
      // members는 전반 기준으로 표시 (후반 교체 선수는 별도 표시 불가)
      rank: 0,
      tieRank: 0,
      pinDiff: 0,
    });
  }

  const sorted = [...combined].sort((a, b) => b.teamTotal - a.teamTotal);
  const leaderTotal = sorted[0]?.teamTotal ?? 0;

  const rankMap = new Map<number, number>();
  sorted.forEach((row, idx) => {
    if (!rankMap.has(row.teamTotal)) {
      rankMap.set(row.teamTotal, idx + 1);
    }
  });

  const rows: TeamRankingRow[] = sorted.map((row) => ({
    ...row,
    rank: rankMap.get(row.teamTotal) ?? 0,
    tieRank: rankMap.get(row.teamTotal) ?? 0,
    pinDiff: Math.max(0, leaderTotal - row.teamTotal),
  }));

  return { rows };
};

export const buildOverallLeaderboard = (input: OverallRankingInput): OverallRankingResult => {
  const merged: Map<string, OverallRankingRow> = new Map();
  const playerMeta = new Map<string, { region: string; affiliation: string; number: number; name: string }>();
  const overallGameColumnCount = getOverallGameColumnCount(input.eventRowsByEventId);

  for (const eventRows of Object.values(input.eventRowsByEventId)) {
    for (const row of eventRows) {
      if (!playerMeta.has(row.playerId)) {
        playerMeta.set(row.playerId, {
          region: row.region,
          affiliation: row.affiliation,
          number: row.number,
          name: row.name,
        });
      }
    }
  }

  const candidatePlayerIds = new Set([
    ...input.playerIds,
    ...playerMeta.keys(),
  ]);

  for (const playerId of candidatePlayerIds) {
    const meta = playerMeta.get(playerId) ?? { region: "", affiliation: "", number: 0, name: "" };
    const gameScores: ScoreColumn[] = emptyScoreColumns(overallGameColumnCount);
    let total = 0;
    let attempts = 0;
    let gameCount = 0;
    const eventTotals: Record<string, number> = {};

    for (const [eventId, eventRows] of Object.entries(input.eventRowsByEventId)) {
      const row = eventRows.find((item) => item.playerId === playerId);
      if (!row) {
        continue;
      }
      eventTotals[eventId] = row.total;
      row.gameScores.forEach((game, index) => {
        if (game.score === null) {
          return;
        }
        if (gameScores[index].score === null) {
          gameScores[index].score = 0;
        }
        gameScores[index].score += game.score;
      });

      total += row.total;
      attempts += row.attempts;
      gameCount += row.gameScores.filter((game) => game.score !== null).length;
    }

    const average = gameCount > 0 ? roundToOneDecimal(total / gameCount) : 0;
    merged.set(playerId, {
      playerId,
      rank: 0,
      tieRank: 0,
      attempts,
      region: meta.region,
      affiliation: meta.affiliation,
      number: meta.number,
      name: meta.name,
      gameScores,
      total,
      average,
      pinDiff: 0,
      gameCount,
      eventTotals,
    });
  }

  const sorted = [...merged.values()].sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    if (b.average !== a.average) {
      return b.average - a.average;
    }
    return a.pinDiff - b.pinDiff;
  });

  const best = sorted[0]?.total ?? 0;
  const rankMap = new Map<number, number>();
  sorted.forEach((row, idx) => {
    if (!rankMap.has(row.total)) {
      rankMap.set(row.total, idx + 1);
    }
  });

  const finalRows: OverallRankingRow[] = sorted.map((row) => ({
    ...row,
    rank: rankMap.get(row.total) ?? 0,
    tieRank: rankMap.get(row.total) ?? 0,
    pinDiff: Math.max(0, best - row.total),
  }));

  return { rows: finalRows };
}
