import type { PlayerRegistrationSubmission, PlayerRegistrationSubmissionPlayer } from "@/lib/models-user";
import { assignEntryGroups } from "@/lib/entry-group";

export type PlayerRegistrationInput = {
  tournamentId: string;
  divisionId: string;
  organizationId: string;
  coachUid: string;
  players: PlayerRegistrationSubmissionPlayer[];
};

const normalizePlayer = (player: PlayerRegistrationSubmissionPlayer): PlayerRegistrationSubmissionPlayer => ({
  name: String(player.name ?? "").trim(),
  affiliation: String(player.affiliation ?? "").trim(),
  group: String(player.group ?? "").trim(),
  region: String(player.region ?? "").trim(),
  number: Number(player.number),
  hand: player.hand === "left" ? "left" : "right",
});

export const normalizePlayerRegistrationPlayers = (players: unknown): PlayerRegistrationSubmissionPlayer[] =>
  Array.isArray(players)
    ? players
      .map((player) => normalizePlayer(player as PlayerRegistrationSubmissionPlayer))
      .filter((player) =>
        player.name &&
        Number.isFinite(player.number) &&
        (player.hand === "left" || player.hand === "right"),
      )
    : [];

export const buildPlayerRegistrationSubmission = (
  id: string,
  input: PlayerRegistrationInput,
  now: string,
): PlayerRegistrationSubmission => ({
  id,
  tournamentId: input.tournamentId,
  divisionId: input.divisionId,
  organizationId: input.organizationId,
  coachUid: input.coachUid,
  status: "SUBMITTED",
  players: input.players,
  createdAt: now,
  updatedAt: now,
  submittedAt: now,
});

export const buildApprovedEntryGroups = (players: PlayerRegistrationSubmissionPlayer[]): Record<number, "A" | "B"> =>
  Object.fromEntries(assignEntryGroups(players).map((player) => [player.number, player.entryGroup]));
