import { buildEventLeaderboard, buildOverallLeaderboard as buildOverall } from "../scoring";
import { buildLaneBoardForGame, assignRandomLanes, LaneRange } from "../lane";
import { EventRankingInput, EventRankingResult, OverallRankingInput, OverallRankingResult } from "../scoring";
import { FivesEventConfig, GameAssignment, Player, ScoreRow } from "../models";

interface RandomAssignInput {
  tournamentId?: string;
  eventId?: string;
  playerIds: string[];
  range: LaneRange;
  gameCount: number;
  tableShift: number;
  seed?: number;
  segments?: RandomAssignmentSegment[];
}

export interface RandomAssignResult {
  gameBoard: Record<number, { playerId: string; laneNumber: number }[]>;
  firstGameAssignments: GameAssignment[];
}

export interface RandomAssignmentSegment {
  startGame: number;
  endGame: number;
  playerIds?: string[];
}

const normalizeSegments = (
  gameCount: number,
  segments?: RandomAssignmentSegment[],
): RandomAssignmentSegment[] => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [{ startGame: 1, endGame: gameCount }];
  }

  return segments
    .map((segment) => ({
      startGame: Number(segment.startGame),
      endGame: Number(segment.endGame),
      playerIds: Array.isArray(segment.playerIds) ? [...segment.playerIds] : undefined,
    }))
    .filter((segment) => (
      Number.isFinite(segment.startGame) &&
      Number.isFinite(segment.endGame) &&
      segment.startGame >= 1 &&
      segment.endGame >= segment.startGame &&
      segment.startGame <= gameCount
    ))
    .map((segment) => ({
      ...segment,
      endGame: Math.min(segment.endGame, gameCount),
    }));
};

export const buildFivesAssignmentSegments = (
  gameCount: number,
  config: FivesEventConfig,
): RandomAssignmentSegment[] => {
  const firstHalfEndGame = Math.max(0, Math.min(gameCount, Number(config.firstHalfGameCount ?? 0)));
  const secondHalfStartGame = firstHalfEndGame + 1;
  const segments: RandomAssignmentSegment[] = [];

  if (firstHalfEndGame >= 1) {
    segments.push({ startGame: 1, endGame: firstHalfEndGame });
  }

  if (secondHalfStartGame <= gameCount) {
    segments.push({ startGame: secondHalfStartGame, endGame: gameCount });
  }

  return segments;
};

export const calculateRandomAssignments = (input: RandomAssignInput): RandomAssignResult => {
  const segments = normalizeSegments(input.gameCount, input.segments);
  const gameBoard: Record<number, { playerId: string; laneNumber: number }[]> = {};
  const firstGameAssignments: GameAssignment[] = [];

  segments.forEach((segment, index) => {
    const segmentPlayerIds = segment.playerIds?.length ? segment.playerIds : input.playerIds;
    const first = assignRandomLanes(segmentPlayerIds, input.range, { seed: (input.seed ?? Date.now()) + index });
    const segmentBoard = buildLaneBoardForGame({
      firstAssignments: first.map((a) => ({ playerId: a.playerId, firstGameLane: a.laneNumber })),
      gameCount: segment.endGame - segment.startGame + 1,
      range: input.range,
      shift: input.tableShift,
    });

    first.forEach((item) => {
      firstGameAssignments.push({
        id: `${item.playerId}-g${segment.startGame}`,
        tournamentId: input.tournamentId ?? "",
        eventId: input.eventId ?? "",
        playerId: item.playerId,
        gameNumber: segment.startGame,
        laneNumber: item.laneNumber,
        createdAt: new Date().toISOString(),
      });
    });

    Object.entries(segmentBoard).forEach(([relativeGame, board]) => {
      const gameNumber = segment.startGame + Number(relativeGame) - 1;
      gameBoard[gameNumber] = board;
    });
  });

  return {
    gameBoard,
    firstGameAssignments,
  };
};

export const buildEventRanking = (input: EventRankingInput): EventRankingResult =>
  buildEventLeaderboard(input);

export const buildOverallRanking = (input: OverallRankingInput): OverallRankingResult =>
  buildOverall(input);
