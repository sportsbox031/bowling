export interface LaneRange {
  start: number;
  end: number;
}

export interface LaneMovementInput {
  playerId: string;
  firstGameLane: number;
}

export interface AssignedLane {
  playerId: string;
  laneNumber: number;
}

export const toLaneRange = (range: LaneRange): LaneRange => {
  if (range.start <= 0 || range.end <= 0) {
    throw new Error("레인은 1 이상의 정수여야 합니다.");
  }

  if (range.end < range.start) {
    return { start: range.end, end: range.start };
  }

  return range;
}

export const getLaneCount = (range: LaneRange): number =>
  toLaneRange(range).end - toLaneRange(range).start + 1;

export const normalizeLane = (lane: number, range: LaneRange): number => {
  const normalized = toLaneRange(range);
  const laneCount = getLaneCount(normalized);
  const zeroBase = (lane - normalized.start) % laneCount;
  const corrected = ((zeroBase % laneCount) + laneCount) % laneCount;

  return normalized.start + corrected;
}

export const getLaneForGame = ({
  initialLane,
  gameNumber,
  range,
  shift,
}: {
  initialLane: number;
  gameNumber: number; // 1-based
  range: LaneRange;
  shift: number;
}): number => {
  const normalized = toLaneRange(range);
  const laneCount = getLaneCount(normalized);
  if (gameNumber < 1) {
    throw new Error("게임 번호는 1 이상이어야 합니다.");
  }

  const startZeroIndex = normalizeLane(initialLane, normalized) - normalized.start;
  const movement = shift * (gameNumber - 1);
  const mod = ((movement % laneCount) + laneCount) % laneCount;
  const targetZeroIndex = (startZeroIndex + mod) % laneCount;

  return normalized.start + targetZeroIndex;
}

const hashSeededRandom = (seed: number): (() => number) => {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const shuffleWithRandom = <T>(items: T[], random: () => number): T[] => {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const temp = cloned[index];
    cloned[index] = cloned[swapWith];
    cloned[swapWith] = temp;
  }

  return cloned;
};

export const assignRandomLanes = (
  playerIds: string[],
  range: LaneRange,
  options?: {
    seed?: number;
  },
): AssignedLane[] => {
  const normalized = toLaneRange(range);
  const totalLanes = getLaneCount(normalized);
  const players = [...playerIds];

  if (players.length === 0) {
    return [];
  }

  if (totalLanes === 0) {
    throw new Error("사용할 레인이 존재하지 않습니다.");
  }

  const seed = options?.seed ?? Date.now();
  const shuffled = shuffleWithRandom(players, hashSeededRandom(seed));

  // 전체 레인에 균등 분배: 선수수 / 레인수로 기본 인원 계산
  const allLanes = Array.from({ length: totalLanes }, (_, index) => normalized.start + index);
  const basePerLane = Math.floor(shuffled.length / totalLanes);
  const remainder = shuffled.length % totalLanes;

  const laneBuckets = allLanes.reduce<Record<number, string[]>>((acc, lane) => {
    acc[lane] = [];
    return acc;
  }, {});

  let playerIndex = 0;
  for (let i = 0; i < allLanes.length; i++) {
    // 앞쪽 레인부터 나머지 1명씩 추가 배정
    const count = basePerLane + (i < remainder ? 1 : 0);
    for (let j = 0; j < count; j++) {
      laneBuckets[allLanes[i]].push(shuffled[playerIndex]);
      playerIndex++;
    }
  }

  return Object.entries(laneBuckets).flatMap(([lane, assigned]) =>
    assigned.map((playerId) => ({ playerId, laneNumber: Number(lane) })),
  );
}

export const buildLaneBoardForGame = (params: {
  firstAssignments: LaneMovementInput[];
  gameCount: number;
  range: LaneRange;
  shift: number;
}): Record<number, AssignedLane[]> => {
  const result: Record<number, AssignedLane[]> = {};

  for (let game = 1; game <= params.gameCount; game += 1) {
    const boardByLane = new Map<number, AssignedLane[]>();

    for (const input of params.firstAssignments) {
      const laneNumber = getLaneForGame({
        initialLane: input.firstGameLane,
        gameNumber: game,
        range: params.range,
        shift: params.shift,
      });

      const list = boardByLane.get(laneNumber) ?? [];
      boardByLane.set(laneNumber, [...list, { playerId: input.playerId, laneNumber }]);
    }

    result[game] = Array.from(boardByLane.entries())
      .sort((a, b) => a[0] - b[0])
      .flatMap(([, players]) => players);
  }

  return result;
}
