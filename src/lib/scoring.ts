import {
  EventRankingRow,
  OverallRankingRow,
  Player,
  ScoreColumn,
  ScoreRow,
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

    for (const eventRows of Object.values(input.eventRowsByEventId)) {
      const row = eventRows.find((item) => item.playerId === playerId);
      if (!row) {
        continue;
      }
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
