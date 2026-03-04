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
  const maxPlayers = totalLanes * 4;

  if (players.length === 0) {
    return [];
  }

  if (totalLanes === 0) {
    throw new Error("사용할 레인이 존재하지 않습니다.");
  }

  if (players.length > maxPlayers) {
    throw new Error("선수 수가 레인당 최대 4명 제약(2~4명/레인)에 맞지 않습니다.");
  }

  const seed = options?.seed ?? Date.now();
  const shuffled = shuffleWithRandom(players, hashSeededRandom(seed));

  // 사용 레인을 최대한 2~4명/레인 규모로 운영. 부족한 경우 마지막 1인레인은 허용.
  const activeLaneCount = Math.min(totalLanes, Math.max(1, Math.ceil(shuffled.length / 4)));
  const activeLanes = Array.from({ length: activeLaneCount }, (_, index) => normalized.start + index);
  const laneBuckets = activeLanes.reduce<Record<number, string[]>>((acc, lane) => {
    acc[lane] = [];
    return acc;
  }, {});

  let lanePointer = 0;
  for (const playerId of shuffled) {
    let loop = 0;
    while (laneBuckets[activeLanes[lanePointer]].length >= 4 && loop < activeLanes.length) {
      lanePointer = (lanePointer + 1) % activeLanes.length;
      loop += 1;
    }

    // 모든 레인에 4명 꽉 찬 경우는 이론상 불가하므로 마지막 안전 가드
    const selectedLane = activeLanes[lanePointer];
    laneBuckets[selectedLane].push(playerId);
    lanePointer = (lanePointer + 1) % activeLanes.length;
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
