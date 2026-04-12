import type { FivesEventConfig, TeamType } from "@/lib/models";

type LegacyEventDoc = {
  id: string;
  title: string;
  kind: string;
  gameCount: number;
  scheduleDate: string;
  laneStart: number;
  laneEnd: number;
  tableShift: number;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyParticipant = {
  id: string;
  playerId?: string;
  squadId?: string;
  createdAt?: string;
};

type LegacySquad = {
  id: string;
  name: string;
  createdAt?: string;
};

type LegacyTeam = {
  id: string;
  name: string;
  teamType: TeamType;
  memberIds: string[];
  rosterIds?: string[];
  linkedTeamId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LegacyFivesTeam = LegacyTeam;

type LegacyAssignment = {
  id?: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  squadId?: string;
  position?: number;
  updatedAt?: string;
};

type LegacyScore = {
  id?: string;
  playerId: string;
  gameNumber: number;
  laneNumber: number;
  score: number;
  updatedAt?: string;
};

export type MergeLegacyFivesInput = {
  firstEvent: LegacyEventDoc;
  secondEvent: LegacyEventDoc;
  firstParticipants: LegacyParticipant[];
  secondParticipants: LegacyParticipant[];
  firstSquads: LegacySquad[];
  secondSquads: LegacySquad[];
  firstTeams: LegacyTeam[];
  secondTeams: LegacyTeam[];
  firstAssignments: LegacyAssignment[];
  secondAssignments: LegacyAssignment[];
  firstScores: LegacyScore[];
  secondScores: LegacyScore[];
  now: string;
  createTeamId?: (sourceTeam: LegacyTeam) => string;
};

export type MergeLegacyFivesResult = {
  event: LegacyEventDoc & {
    fivesConfig: FivesEventConfig;
    linkedEventId?: never;
    halfType?: never;
  };
  participants: Array<{ id: string; data: { playerId: string; squadId?: string; createdAt: string } }>;
  squads: Array<{ id: string; data: { name: string; createdAt: string } }>;
  teams: Array<{
    id: string;
    data: {
      name: string;
      teamType: TeamType;
      memberIds: string[];
      rosterIds: string[];
      firstHalfMemberIds: string[];
      secondHalfMemberIds: string[];
      createdAt: string;
      updatedAt: string;
    };
  }>;
  assignments: Array<{
    id: string;
    data: {
      playerId: string;
      gameNumber: number;
      laneNumber: number;
      squadId?: string;
      position?: number;
      updatedAt: string;
    };
  }>;
  scores: Array<{
    id: string;
    data: {
      playerId: string;
      gameNumber: number;
      laneNumber: number;
      score: number;
      updatedAt: string;
    };
  }>;
  archiveEventIds: string[];
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const normalizeName = (value: string) => value.trim().toLocaleLowerCase("ko");
const normalizeTeamName = (value: string) =>
  normalizeName(value).replace(/\s+/g, "").replace(/a$/, "");
const stripTrailingGroupSuffix = (value: string) => value.trim().replace(/\s*[A-Za-z]$/, "").trim();

const getMergedNormalTeamName = (firstName: string, secondName?: string) => {
  const candidates = [firstName, secondName ?? ""]
    .map((name) => stripTrailingGroupSuffix(name))
    .filter(Boolean);
  if (candidates.length === 0) return firstName;
  return [...candidates].sort((a, b) => a.length - b.length)[0] ?? firstName;
};

const normalizeParticipant = (
  participant: LegacyParticipant,
  squadIdMap?: Map<string, string>,
) => {
  const playerId = String(participant.playerId ?? participant.id ?? "").trim();
  if (!playerId) {
    throw new Error("PARTICIPANT_ID_REQUIRED");
  }

  const canonicalSquadId = participant.squadId ? squadIdMap?.get(participant.squadId) ?? participant.squadId : undefined;

  return {
    id: playerId,
    data: {
      playerId,
      ...(canonicalSquadId ? { squadId: canonicalSquadId } : {}),
      createdAt: participant.createdAt ?? new Date().toISOString(),
    },
  };
};

const mergeById = <T extends { id: string }>(first: T[], second: T[]) => {
  const merged = new Map<string, T>();
  [...first, ...second].forEach((item) => {
    if (!merged.has(item.id)) {
      merged.set(item.id, item);
    }
  });
  return Array.from(merged.values());
};

const makeAssignmentId = (playerId: string, gameNumber: number) => `${playerId}_${gameNumber}`;

const buildCanonicalSquads = (
  firstSquads: LegacySquad[],
  secondSquads: LegacySquad[],
  now: string,
) => {
  const canonicalByName = new Map<string, LegacySquad>();
  const squadIdMap = new Map<string, string>();

  [...firstSquads, ...secondSquads].forEach((squad) => {
    const key = normalizeName(squad.name);
    const canonical = canonicalByName.get(key) ?? squad;
    if (!canonicalByName.has(key)) {
      canonicalByName.set(key, canonical);
    }
    squadIdMap.set(squad.id, canonical.id);
  });

  return {
    squadIdMap,
    squads: Array.from(canonicalByName.values()).map((squad) => ({
      id: squad.id,
      data: {
        name: squad.name,
        createdAt: squad.createdAt ?? now,
      },
    })),
  };
};

const shiftAssignments = (
  items: LegacyAssignment[],
  gameOffset: number,
  now: string,
  squadIdMap?: Map<string, string>,
) => items.map((item) => {
  const gameNumber = Number(item.gameNumber) + gameOffset;
  const canonicalSquadId = item.squadId ? squadIdMap?.get(item.squadId) ?? item.squadId : undefined;
  return {
    id: makeAssignmentId(item.playerId, gameNumber),
    data: {
      playerId: item.playerId,
      gameNumber,
      laneNumber: Number(item.laneNumber),
      ...(canonicalSquadId ? { squadId: canonicalSquadId } : {}),
      ...(Number.isFinite(item.position) ? { position: Number(item.position) } : {}),
      updatedAt: now,
    },
  };
});

const shiftScores = (
  items: LegacyScore[],
  gameOffset: number,
  now: string,
) => items.map((item) => {
  const gameNumber = Number(item.gameNumber) + gameOffset;
  return {
    id: makeAssignmentId(item.playerId, gameNumber),
    data: {
      playerId: item.playerId,
      gameNumber,
      laneNumber: Number(item.laneNumber),
      score: Number(item.score),
      updatedAt: now,
    },
  };
});

const findMatchingSecondTeam = (firstTeam: LegacyTeam, secondTeams: LegacyTeam[]) =>
  secondTeams.find((team) => team.linkedTeamId === firstTeam.id)
  ?? [...secondTeams]
    .map((team) => {
      if (team.teamType !== firstTeam.teamType) {
        return { team, score: -1 };
      }

      const overlap = team.memberIds.filter((playerId) => firstTeam.memberIds.includes(playerId)).length;
      const exactName = normalizeName(team.name) === normalizeName(firstTeam.name) ? 100 : 0;
      const normalizedName = normalizeTeamName(team.name) === normalizeTeamName(firstTeam.name) ? 50 : 0;
      return { team, score: exactName + normalizedName + overlap * 10 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.team;

export const mergeLegacyFivesTeams = (input: {
  firstTeams: LegacyFivesTeam[];
  secondTeams: LegacyFivesTeam[];
  now: string;
  createTeamId?: (sourceTeam: LegacyFivesTeam) => string;
}) => {
  const matchedSecondTeamIds = new Set<string>();
  const teams = input.firstTeams.map((firstTeam) => {
    const secondTeam = findMatchingSecondTeam(
      firstTeam,
      input.secondTeams.filter((candidate) => !matchedSecondTeamIds.has(candidate.id)),
    );
    if (secondTeam) {
      matchedSecondTeamIds.add(secondTeam.id);
    }

    const firstHalfMemberIds = unique(firstTeam.memberIds);
    const secondHalfMemberIds = unique(secondTeam?.memberIds ?? firstTeam.memberIds);
    const rosterIds = unique([
      ...(firstTeam.rosterIds ?? firstTeam.memberIds),
      ...(secondTeam?.rosterIds ?? secondTeam?.memberIds ?? []),
    ]);
    const mergedName = firstTeam.teamType === "NORMAL"
      ? getMergedNormalTeamName(firstTeam.name, secondTeam?.name)
      : firstTeam.name;

    return {
      id: firstTeam.id,
      data: {
        name: mergedName,
        teamType: firstTeam.teamType,
        memberIds: firstHalfMemberIds,
        rosterIds,
        firstHalfMemberIds,
        secondHalfMemberIds,
        createdAt: firstTeam.createdAt ?? input.now,
        updatedAt: input.now,
      },
    };
  });

  const unmatchedSecondTeams = input.secondTeams
    .filter((team) => !matchedSecondTeamIds.has(team.id))
    .map((team) => {
      const id = input.createTeamId ? input.createTeamId(team) : `${team.id}-merged`;
      const rosterIds = unique(team.rosterIds ?? team.memberIds);
      const lineup = unique(team.memberIds);
      return {
        id,
        data: {
          name: team.name,
          teamType: team.teamType,
          memberIds: lineup,
          rosterIds,
          firstHalfMemberIds: lineup,
          secondHalfMemberIds: lineup,
          createdAt: team.createdAt ?? input.now,
          updatedAt: input.now,
        },
      };
    });

  return [...teams, ...unmatchedSecondTeams];
};

export const mergeLegacyFivesEvents = (input: MergeLegacyFivesInput): MergeLegacyFivesResult => {
  const firstGameCount = Number(input.firstEvent.gameCount ?? 0);
  const secondGameCount = Number(input.secondEvent.gameCount ?? 0);
  const now = input.now;
  const canonicalSquads = buildCanonicalSquads(input.firstSquads, input.secondSquads, now);

  const teams = mergeLegacyFivesTeams({
    firstTeams: input.firstTeams,
    secondTeams: input.secondTeams,
    now,
    createTeamId: input.createTeamId,
  });

  return {
    event: {
      ...input.firstEvent,
      gameCount: firstGameCount + secondGameCount,
      updatedAt: now,
      fivesConfig: {
        firstHalfGameCount: firstGameCount,
        secondHalfGameCount: secondGameCount,
      },
    },
    participants: mergeById(
      input.firstParticipants.map((participant) => normalizeParticipant(participant, canonicalSquads.squadIdMap)),
      input.secondParticipants.map((participant) => normalizeParticipant(participant, canonicalSquads.squadIdMap)),
    ).map((participant) => ({
      id: participant.id,
      data: {
        playerId: participant.data.playerId,
        ...(participant.data.squadId ? { squadId: participant.data.squadId } : {}),
        createdAt: participant.data.createdAt,
      },
    })),
    squads: canonicalSquads.squads,
    teams,
    assignments: [
      ...shiftAssignments(input.firstAssignments, 0, now, canonicalSquads.squadIdMap),
      ...shiftAssignments(input.secondAssignments, firstGameCount, now, canonicalSquads.squadIdMap),
    ],
    scores: [
      ...shiftScores(input.firstScores, 0, now),
      ...shiftScores(input.secondScores, firstGameCount, now),
    ],
    archiveEventIds: [input.secondEvent.id],
  };
};
