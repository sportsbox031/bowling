import type { EventType } from "@/lib/models";
import type { TeamEntrySubmission, TeamEntrySubmissionTeam } from "@/lib/models-user";
import { normalizeFivesLineups } from "@/lib/fives-lineup";
import { buildAutoTeamNames } from "@/lib/team-submission-draft";

export type TeamEntryInput = {
  tournamentId: string;
  divisionId: string;
  eventId: string;
  organizationId: string;
  coachUid: string;
  teams: TeamEntrySubmissionTeam[];
};

type TeamEntryPlayerLike = {
  entryGroup?: string | null;
};

const EVENT_TEAM_SIZE: Partial<Record<EventType, number>> = {
  DOUBLES: 2,
  TRIPLES: 3,
  FIVES: 5,
};

export const getRequiredTeamSize = (eventKind: EventType): number => EVENT_TEAM_SIZE[eventKind] ?? 0;

const uniqueIds = (ids: unknown): string[] =>
  Array.isArray(ids)
    ? [...new Set(ids.map((value) => String(value ?? "").trim()).filter(Boolean))]
    : [];

export const normalizeTeamEntryTeams = (
  eventKind: EventType,
  rawTeams: unknown,
): TeamEntrySubmissionTeam[] => {
  if (!Array.isArray(rawTeams)) return [];

  const teamSize = getRequiredTeamSize(eventKind);
  if (!teamSize) return [];

  return rawTeams
    .map((rawTeam) => {
      const team = rawTeam as TeamEntrySubmissionTeam;
      const playerIds = uniqueIds(team.playerIds);

      if (eventKind === "FIVES") {
        const lineups = normalizeFivesLineups({
          rosterIds: playerIds,
          firstHalfMemberIds: uniqueIds(team.firstHalfMemberIds),
        });

        return {
          name: typeof team.name === "string" ? team.name.trim() : "",
          playerIds: lineups.rosterIds,
          entryGroup: team.entryGroup === "B" ? "B" : "A",
          firstHalfMemberIds: lineups.firstHalfMemberIds,
        } satisfies TeamEntrySubmissionTeam;
      }

      return {
        name: typeof team.name === "string" ? team.name.trim() : "",
        playerIds,
        entryGroup: team.entryGroup === "B" ? "B" : "A",
      } satisfies TeamEntrySubmissionTeam;
    })
    .filter((team) => {
      if (eventKind === "DOUBLES" || eventKind === "TRIPLES") {
        return team.playerIds.length >= 1 && team.playerIds.length <= teamSize;
      }
      if (eventKind === "FIVES") {
        return team.playerIds.length >= 1 && team.playerIds.length <= 7;
      }
      return team.playerIds.length === teamSize;
    });
};

export const validateNoDuplicatePlayersAcrossTeams = (teams: TeamEntrySubmissionTeam[]): boolean => {
  const seen = new Set<string>();
  for (const team of teams) {
    for (const playerId of team.playerIds) {
      if (seen.has(playerId)) return false;
      seen.add(playerId);
    }
  }
  return true;
};

export const assignEntryGroupsToTeams = (
  teams: TeamEntrySubmissionTeam[],
  getPlayerById: (playerId: string) => TeamEntryPlayerLike | undefined,
): TeamEntrySubmissionTeam[] | null => {
  const resolvedTeams = teams.map((team) => {
    const groups = [...new Set(
      team.playerIds
        .map((playerId) => String(getPlayerById(playerId)?.entryGroup ?? "").trim())
        .filter((group) => group === "A" || group === "B"),
    )];

    if (groups.length !== 1) {
      return null;
    }

    return {
      ...team,
      entryGroup: groups[0] as "A" | "B",
    };
  });

  return resolvedTeams.every((team) => team !== null)
    ? resolvedTeams
    : null;
};

export const buildAutoNamedTeams = (
  organizationName: string,
  teams: TeamEntrySubmissionTeam[],
): TeamEntrySubmissionTeam[] => {
  const names = buildAutoTeamNames(organizationName, teams);
  return teams.map((team, index) => ({
    ...team,
    name: names[index] ?? team.name ?? "",
  }));
};

export const buildTeamEntrySubmission = (
  id: string,
  input: TeamEntryInput,
  now: string,
): TeamEntrySubmission => ({
  id,
  tournamentId: input.tournamentId,
  divisionId: input.divisionId,
  eventId: input.eventId,
  organizationId: input.organizationId,
  coachUid: input.coachUid,
  status: "SUBMITTED",
  teams: input.teams,
  createdAt: now,
  updatedAt: now,
  submittedAt: now,
});
