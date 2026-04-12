import type { EventType, TeamType } from "@/lib/models";

type TeamIdentityPlayer = {
  affiliation?: string;
  group?: string;
};

export function deriveTeamIdentity(
  players: TeamIdentityPlayer[],
  options?: { eventKind?: EventType | null; requiredSize?: number | null },
): {
  teamType: TeamType;
  normalTeamName?: string;
} {
  const requiredSize = Number(options?.requiredSize ?? 0);
  if (
    (options?.eventKind === "DOUBLES" || options?.eventKind === "TRIPLES" || options?.eventKind === "FIVES")
    && requiredSize > 0
    && players.length > 0
    && players.length < requiredSize
  ) {
    return { teamType: "PARTIAL" };
  }

  const affiliations = players.map((player) => player.affiliation?.trim() ?? "");
  const groups = players.map((player) => player.group?.trim() ?? "");
  const uniqueAffiliations = new Set(affiliations.filter(Boolean));
  const uniqueGroups = new Set(groups.filter(Boolean));
  const teamType: TeamType = players.length >= 2 && uniqueAffiliations.size === 1 ? "NORMAL" : "MAKEUP";

  if (teamType !== "NORMAL") {
    return { teamType };
  }

  const baseName = [...uniqueAffiliations][0] ?? "";
  const groupLabel = uniqueGroups.size === 1 ? [...uniqueGroups][0] ?? "" : "";

  return {
    teamType,
    normalTeamName: `${baseName}${groupLabel}`,
  };
}
