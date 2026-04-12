export type ApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "DISABLED";

export type OrganizationStatus = "ACTIVE" | "PENDING" | "DISABLED";

export type SubmissionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export type EntryGroup = "A" | "B";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone: string;
  status: ApprovalStatus;
  privacyConsentAt: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  disabledAt?: string;
  disabledBy?: string;
  lastLoginAt?: string;
  primaryOrganizationId?: string;
}

export interface Organization {
  id: string;
  name: string;
  normalizedName: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  disabledAt?: string;
  disabledBy?: string;
}

export interface UserOrganizationMembership {
  id: string;
  uid: string;
  organizationId: string;
  role: "COACH";
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  removalRequestedAt?: string;
  removalRequestedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  disabledAt?: string;
  disabledBy?: string;
}

export interface PlayerRegistrationSubmissionPlayer {
  name: string;
  affiliation?: string;
  group?: string;
  region?: string;
  number: number;
  hand?: "left" | "right";
}

export interface PlayerRegistrationSubmission {
  id: string;
  tournamentId: string;
  divisionId: string;
  organizationId: string;
  coachUid: string;
  status: SubmissionStatus;
  players: PlayerRegistrationSubmissionPlayer[];
  entryGroups?: Record<number, EntryGroup>;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface TeamEntrySubmissionTeam {
  name?: string;
  playerIds: string[];
  entryGroup: EntryGroup;
  firstHalfMemberIds?: string[];
  secondHalfMemberIds?: string[];
}

export interface TeamEntrySubmission {
  id: string;
  tournamentId: string;
  divisionId: string;
  eventId: string;
  organizationId: string;
  coachUid: string;
  status: SubmissionStatus;
  teams: TeamEntrySubmissionTeam[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface FivesSubstitutionSubmission {
  id: string;
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
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface ApprovalAction {
  id: string;
  targetType: "USER" | "ORGANIZATION" | "PLAYER_SUBMISSION" | "TEAM_SUBMISSION" | "FIVES_SUBSTITUTION";
  targetId: string;
  action: "APPROVE" | "REJECT" | "DISABLE" | "RESET_PASSWORD";
  actorUid: string;
  createdAt: string;
  note?: string;
}
