import { getLaneForGame } from "./lane";
import type { TeamType } from "./models";

export type ParticipantSeed = {
  id?: string;
  playerId?: string;
  squadId?: string;
  createdAt?: string;
};

export type SquadSeed = {
  id: string;
  name: string;
  createdAt?: string;
};

export type TeamSeed = {
  id: string;
  tournamentId?: string;
  divisionId?: string;
  eventId?: string;
  name: string;
  teamType: TeamType;
  memberIds: string[];
  rosterIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  linkedTeamId?: string;
};

export type AssignmentSeed = {
  id?: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  squadId?: string;
  updatedAt?: string;
};

export type TargetMeta = {
  tournamentId: string;
  divisionId: string;
  eventId: string;
};

export function cloneFivesEventData(params: {
  sourceParticipants: ParticipantSeed[];
  sourceSquads: SquadSeed[];
  sourceTeams: TeamSeed[];
  sourceAssignments?: AssignmentSeed[];
  sourceGameCount?: number;
  targetMeta: TargetMeta;
  targetGameCount?: number;
  targetLaneRange?: { start: number; end: number };
  targetTableShift?: number;
  now: string;
  createSquadId: (sourceSquadId: string) => string;
  createTeamId: (sourceTeamId: string) => string;
}) {
  const squadIdMap = new Map<string, string>();

  const squads = params.sourceSquads.map((squad) => {
    const copiedId = params.createSquadId(squad.id);
    squadIdMap.set(squad.id, copiedId);
    return {
      id: copiedId,
      data: {
        name: squad.name,
        createdAt: squad.createdAt ?? params.now,
      },
    };
  });

  const participants = params.sourceParticipants.map((participant) => {
    const playerId = participant.playerId ?? participant.id;
    if (!playerId) {
      throw new Error("PARTICIPANT_ID_REQUIRED");
    }

    return {
      id: playerId,
      data: {
        playerId,
        ...(participant.squadId && squadIdMap.has(participant.squadId)
          ? { squadId: squadIdMap.get(participant.squadId) }
          : {}),
        createdAt: params.now,
      },
    };
  });

  const teams = params.sourceTeams.map((team) => ({
    id: params.createTeamId(team.id),
    data: {
      tournamentId: params.targetMeta.tournamentId,
      divisionId: params.targetMeta.divisionId,
      eventId: params.targetMeta.eventId,
      name: team.name,
      teamType: team.teamType,
      memberIds: [...team.memberIds],
      ...(team.rosterIds ? { rosterIds: [...team.rosterIds] } : {}),
      linkedTeamId: team.id,
      createdAt: team.createdAt ?? params.now,
      updatedAt: params.now,
    },
  }));

  const assignments = buildCarriedAssignments({
    sourceAssignments: params.sourceAssignments ?? [],
    sourceGameCount: params.sourceGameCount ?? 0,
    targetGameCount: params.targetGameCount ?? 0,
    targetLaneRange: params.targetLaneRange,
    targetTableShift: params.targetTableShift ?? 0,
    squadIdMap,
    now: params.now,
  });

  return { participants, squads, teams, assignments };
}

function buildCarriedAssignments(params: {
  sourceAssignments: AssignmentSeed[];
  sourceGameCount: number;
  targetGameCount: number;
  targetLaneRange?: { start: number; end: number };
  targetTableShift: number;
  squadIdMap: Map<string, string>;
  now: string;
}) {
  if (!params.targetLaneRange || params.sourceGameCount < 1 || params.targetGameCount < 1) {
    return [];
  }

  const lastGameAssignments = params.sourceAssignments
    .filter((item) => item.gameNumber === params.sourceGameCount)
    .sort((a, b) => a.laneNumber - b.laneNumber || a.playerId.localeCompare(b.playerId));

  if (lastGameAssignments.length === 0) {
    return [];
  }

  const firstGame = lastGameAssignments.map((item) => {
    const carriedLane = getLaneForGame({
      initialLane: item.laneNumber,
      gameNumber: 2,
      range: params.targetLaneRange!,
      shift: params.targetTableShift,
    });

    return {
      playerId: item.playerId,
      laneNumber: carriedLane,
      squadId: item.squadId && params.squadIdMap.has(item.squadId)
        ? params.squadIdMap.get(item.squadId)
        : undefined,
    };
  });

  const generated = [] as Array<{ id: string; data: Record<string, string | number> }>;
  for (const seed of firstGame) {
    for (let gameNumber = 1; gameNumber <= params.targetGameCount; gameNumber += 1) {
      const laneNumber = gameNumber === 1
        ? seed.laneNumber
        : getLaneForGame({
            initialLane: seed.laneNumber,
            gameNumber,
            range: params.targetLaneRange!,
            shift: params.targetTableShift,
          });

      generated.push({
        id: `${seed.playerId}_${gameNumber}`,
        data: {
          playerId: seed.playerId,
          gameNumber,
          laneNumber,
          ...(seed.squadId ? { squadId: seed.squadId } : {}),
          updatedAt: params.now,
        },
      });
    }
  }

  return generated;
}
