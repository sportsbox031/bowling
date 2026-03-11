export type PositionedAssignment = {
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  position?: number;
};

export const sortAssignmentsByPosition = <T extends PositionedAssignment>(assignments: T[]): T[] =>
  [...assignments].sort((a, b) =>
    a.gameNumber - b.gameNumber ||
    a.laneNumber - b.laneNumber ||
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    a.playerId.localeCompare(b.playerId),
  );

export const withAssignmentPositions = <T extends PositionedAssignment>(assignments: T[]): T[] => {
  const lanePositionMap = new Map<string, number>();

  return assignments.map((assignment) => {
    const laneKey = `${assignment.gameNumber}:${assignment.laneNumber}`;
    const nextPosition = lanePositionMap.get(laneKey) ?? 1;
    lanePositionMap.set(laneKey, nextPosition + 1);
    return {
      ...assignment,
      position: nextPosition,
    };
  });
};
