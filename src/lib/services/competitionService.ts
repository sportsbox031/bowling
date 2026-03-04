import { buildEventLeaderboard, buildOverallLeaderboard as buildOverall } from "../scoring";
import { buildLaneBoardForGame, assignRandomLanes, LaneRange } from "../lane";
import { EventRankingInput, EventRankingResult, OverallRankingInput, OverallRankingResult } from "../scoring";
import { GameAssignment, Player, ScoreRow } from "../models";

interface RandomAssignInput {
  tournamentId?: string;
  eventId?: string;
  playerIds: string[];
  range: LaneRange;
  gameCount: number;
  tableShift: number;
  seed?: number;
}

export interface RandomAssignResult {
  gameBoard: Record<number, { playerId: string; laneNumber: number }[]>;
  firstGameAssignments: GameAssignment[];
}

export const calculateRandomAssignments = (input: RandomAssignInput): RandomAssignResult => {
  const first = assignRandomLanes(input.playerIds, input.range, { seed: input.seed });
  const firstGameAssignments: GameAssignment[] = first.map((item) => ({
    id: `${item.playerId}-g1`,
    tournamentId: input.tournamentId ?? "",
    eventId: input.eventId ?? "",
    playerId: item.playerId,
    gameNumber: 1,
    laneNumber: item.laneNumber,
    createdAt: new Date().toISOString(),
  }));

  const board = buildLaneBoardForGame({
    firstAssignments: first.map((a) => ({ playerId: a.playerId, firstGameLane: a.laneNumber })),
    gameCount: input.gameCount,
    range: input.range,
    shift: input.tableShift,
  });

  return {
    gameBoard: board,
    firstGameAssignments,
  };
};

export const buildEventRanking = (input: EventRankingInput): EventRankingResult =>
  buildEventLeaderboard(input);

export const buildOverallRanking = (input: OverallRankingInput): OverallRankingResult =>
  buildOverall(input);
