import type { FivesSubstitutionSubmission } from "@/lib/models-user";

export type FivesSubstitutionInput = {
  tournamentId: string;
  divisionId: string;
  eventId: string;
  organizationId: string;
  coachUid: string;
  teamId: string;
  teamEntrySubmissionId?: string;
  rosterIds: string[];
  firstHalfMemberIds: string[];
  secondHalfMemberIds: string[];
};

const uniqueIds = (ids: unknown): string[] =>
  Array.isArray(ids)
    ? [...new Set(ids.map((value) => String(value ?? "").trim()).filter(Boolean))]
    : [];

export const normalizeFivesSubstitutionPayload = (payload: {
  rosterIds?: unknown;
  firstHalfMemberIds?: unknown;
  secondHalfMemberIds?: unknown;
}) => ({
  rosterIds: uniqueIds(payload.rosterIds),
  firstHalfMemberIds: uniqueIds(payload.firstHalfMemberIds),
  secondHalfMemberIds: uniqueIds(payload.secondHalfMemberIds),
});

export const isValidFivesSubstitution = (payload: {
  rosterIds: string[];
  firstHalfMemberIds: string[];
  secondHalfMemberIds: string[];
}) => {
  if (payload.rosterIds.length < 5 || payload.rosterIds.length > 7) {
    return false;
  }

  if (payload.firstHalfMemberIds.length !== 5 || payload.secondHalfMemberIds.length !== 5) {
    return false;
  }

  return payload.firstHalfMemberIds.every((playerId) => payload.rosterIds.includes(playerId))
    && payload.secondHalfMemberIds.every((playerId) => payload.rosterIds.includes(playerId));
};

export const buildFivesSubstitutionSubmission = (
  id: string,
  input: FivesSubstitutionInput,
  now: string,
): FivesSubstitutionSubmission => ({
  id,
  tournamentId: input.tournamentId,
  divisionId: input.divisionId,
  eventId: input.eventId,
  organizationId: input.organizationId,
  coachUid: input.coachUid,
  teamId: input.teamId,
  ...(input.teamEntrySubmissionId ? { teamEntrySubmissionId: input.teamEntrySubmissionId } : {}),
  rosterIds: input.rosterIds,
  firstHalfMemberIds: input.firstHalfMemberIds,
  secondHalfMemberIds: input.secondHalfMemberIds,
  status: "SUBMITTED",
  createdAt: now,
  updatedAt: now,
  submittedAt: now,
});
