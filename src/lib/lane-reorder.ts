export type LaneReorderAssignment = {
  id: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
};

export const reorderAssignmentsWithinLane = <T extends LaneReorderAssignment>(
  assignments: T[],
  params: {
    gameNumber: number;
    laneNumber: number;
    draggedPlayerId: string;
    targetPlayerId: string;
  },
): T[] => {
  const { gameNumber, laneNumber, draggedPlayerId, targetPlayerId } = params;
  if (draggedPlayerId === targetPlayerId) return assignments;

  const draggedIndex = assignments.findIndex(
    (item) =>
      item.gameNumber === gameNumber &&
      item.laneNumber === laneNumber &&
      item.playerId === draggedPlayerId,
  );
  const targetIndex = assignments.findIndex(
    (item) =>
      item.gameNumber === gameNumber &&
      item.laneNumber === laneNumber &&
      item.playerId === targetPlayerId,
  );

  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
    return assignments;
  }

  const nextAssignments = [...assignments];
  const dragged = nextAssignments[draggedIndex];
  nextAssignments[draggedIndex] = nextAssignments[targetIndex];
  nextAssignments[targetIndex] = dragged;
  return nextAssignments;
};
