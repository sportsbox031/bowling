export type RankRefreshEventState = {
  rankRefreshPending?: boolean;
  rankRefreshedAt?: string | null;
};

export type ScoreboardScoreColumn = {
  gameNumber: number;
  score: number | null;
};

export type ScoreboardEventRow = {
  playerId: string;
  gameScores: ScoreboardScoreColumn[];
};

export const applyScoreToEventRows = <T extends ScoreboardEventRow>(
  rows: T[],
  params: { playerId: string; gameNumber: number; score: number },
): T[] => rows.map((row) => {
  if (row.playerId !== params.playerId) return row;
  return {
    ...row,
    gameScores: row.gameScores.map((column) => (
      column.gameNumber === params.gameNumber
        ? { ...column, score: params.score }
        : column
    )),
  };
});

export const markRankRefreshPending = <T extends RankRefreshEventState>(event: T): T => ({
  ...event,
  rankRefreshPending: true,
});

export const markRankRefreshComplete = <T extends RankRefreshEventState>(event: T, rankRefreshedAt: string): T => ({
  ...event,
  rankRefreshPending: false,
  rankRefreshedAt,
});
