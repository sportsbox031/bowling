import { Division, EventSpec, GameAssignment, GlobalPlayer, Player, ScoreRow, Team, Tournament } from "../models";
import {
  ApprovalAction,
  FivesSubstitutionSubmission,
  Organization,
  PlayerRegistrationSubmission,
  TeamEntrySubmission,
  UserOrganizationMembership,
  UserProfile,
} from "../models-user";

export const COLLECTIONS = {
  Tournaments: "tournaments",
  Divisions: "divisions",
  Events: "events",
  Players: "players",
  Scores: "scores",
  Assignments: "assignments",
  Teams: "teams",
  TeamMembers: "teamMembers",
  Users: "users",
  Organizations: "organizations",
  OrganizationMemberships: "organizationMemberships",
  ApprovalLogs: "approvalLogs",
  PlayerRegistrationSubmissions: "playerRegistrationSubmissions",
  TeamEntrySubmissions: "teamEntrySubmissions",
  FivesSubstitutionSubmissions: "fivesSubstitutionSubmissions",
  System: "system",
  GlobalPlayers: "globalPlayers",
} as const;

export interface TournamentDocument extends Tournament {}

export interface DivisionDocument extends Division {}

export interface EventDocument extends EventSpec {}

export interface PlayerDocument extends Player {}

export interface ScoreDocument extends ScoreRow {}

export interface AssignmentDocument extends GameAssignment {}

export interface GlobalPlayerDocument extends GlobalPlayer {}

export interface TeamDocument extends Team {}

export interface UserDocument extends UserProfile {}

export interface OrganizationDocument extends Organization {}

export interface UserOrganizationMembershipDocument extends UserOrganizationMembership {}

export interface PlayerRegistrationSubmissionDocument extends PlayerRegistrationSubmission {}

export interface TeamEntrySubmissionDocument extends TeamEntrySubmission {}

export interface FivesSubstitutionSubmissionDocument extends FivesSubstitutionSubmission {}

export interface ApprovalLogDocument extends ApprovalAction {}

export const firestorePaths = {
  tournament: (tournamentId: string) => `tournaments/${tournamentId}`,
  divisions: (tournamentId: string) => `tournaments/${tournamentId}/divisions`,
  division: (tournamentId: string, divisionId: string) => `tournaments/${tournamentId}/divisions/${divisionId}`,
  events: (tournamentId: string, divisionId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events`,
  event: (tournamentId: string, divisionId: string, eventId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}`,
  players: (tournamentId: string) => `tournaments/${tournamentId}/players`,
  player: (tournamentId: string, playerId: string) =>
    `tournaments/${tournamentId}/players/${playerId}`,
  scores: (tournamentId: string, divisionId: string, eventId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/scores`,
  assignments: (tournamentId: string, divisionId: string, eventId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/assignments`,
  teams: (tournamentId: string, divisionId: string, eventId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/teams`,
  team: (tournamentId: string, divisionId: string, eventId: string, teamId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/teams/${teamId}`,
  teamMembers: (tournamentId: string, divisionId: string, eventId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/teamMembers`,
  teamMember: (tournamentId: string, divisionId: string, eventId: string, playerId: string) =>
    `tournaments/${tournamentId}/divisions/${divisionId}/events/${eventId}/teamMembers/${playerId}`,
  globalPlayers: () => "globalPlayers",
  globalPlayer: (shortId: string) => `globalPlayers/${shortId}`,
  users: () => "users",
  user: (uid: string) => `users/${uid}`,
  organizations: () => "organizations",
  organization: (organizationId: string) => `organizations/${organizationId}`,
  organizationMemberships: () => "organizationMemberships",
  organizationMembership: (membershipId: string) => `organizationMemberships/${membershipId}`,
  approvalLogs: () => "approvalLogs",
  approvalLog: (approvalLogId: string) => `approvalLogs/${approvalLogId}`,
  playerRegistrationSubmissions: (tournamentId: string) =>
    `tournaments/${tournamentId}/playerRegistrationSubmissions`,
  playerRegistrationSubmission: (tournamentId: string, submissionId: string) =>
    `tournaments/${tournamentId}/playerRegistrationSubmissions/${submissionId}`,
  teamEntrySubmissions: (tournamentId: string) =>
    `tournaments/${tournamentId}/teamEntrySubmissions`,
  teamEntrySubmission: (tournamentId: string, submissionId: string) =>
    `tournaments/${tournamentId}/teamEntrySubmissions/${submissionId}`,
  fivesSubstitutionSubmissions: (tournamentId: string) =>
    `tournaments/${tournamentId}/fivesSubstitutionSubmissions`,
  fivesSubstitutionSubmission: (tournamentId: string, submissionId: string) =>
    `tournaments/${tournamentId}/fivesSubstitutionSubmissions/${submissionId}`,
  shortIdCounter: () => "system/shortIdCounter",
} as const;
