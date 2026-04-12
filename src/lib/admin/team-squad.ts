import { getTeamRosterIds } from "@/lib/team-lineup";

type TeamLike = {
  id: string;
  name: string;
  teamType: "NORMAL" | "MAKEUP" | "PARTIAL";
  memberIds: string[];
  rosterIds?: string[];
  firstHalfMemberIds?: string[];
  secondHalfMemberIds?: string[];
};

type PlayerLike = {
  id: string;
  number: number;
  name: string;
  affiliation: string;
};

type ParticipantLike = {
  id: string;
  playerId?: string;
  squadId?: string;
};

export type TeamSquadCard = {
  id: string;
  name: string;
  teamType: "NORMAL" | "MAKEUP" | "PARTIAL";
  rosterIds: string[];
  memberSquadIds: string[];
  currentSquadId: string | null;
  status: "assigned" | "unassigned" | "mixed";
  members: PlayerLike[];
};

const normalizeSquadId = (value?: string) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
};

export const buildTeamSquadCards = (
  teams: TeamLike[],
  players: PlayerLike[],
  participants: ParticipantLike[],
  squadFilterId?: string | null,
): TeamSquadCard[] => {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const participantByPlayerId = new Map(
    participants.map((participant) => [participant.playerId ?? participant.id, participant]),
  );
  const normalizedFilterId = normalizeSquadId(squadFilterId ?? undefined);

  return teams
    .map((team) => {
      const rosterIds = getTeamRosterIds(team);
      const members = rosterIds
        .map((playerId) => playerById.get(playerId))
        .filter(Boolean) as PlayerLike[];
      const memberSquadIds = rosterIds
        .map((playerId) => normalizeSquadId(participantByPlayerId.get(playerId)?.squadId))
        .filter(Boolean) as string[];
      const uniqueSquadIds = [...new Set(memberSquadIds)];
      const currentSquadId = uniqueSquadIds.length === 1 ? uniqueSquadIds[0] : null;
      const status =
        uniqueSquadIds.length === 0
          ? "unassigned"
          : uniqueSquadIds.length === 1
            ? "assigned"
            : "mixed";

      return {
        id: team.id,
        name: team.name,
        teamType: team.teamType,
        rosterIds,
        memberSquadIds: uniqueSquadIds,
        currentSquadId,
        status,
        members,
      } satisfies TeamSquadCard;
    })
    .filter((card) => {
      if (!normalizedFilterId) {
        return true;
      }

      if (card.currentSquadId === normalizedFilterId) {
        return true;
      }

      return card.memberSquadIds.includes(normalizedFilterId);
    });
};
