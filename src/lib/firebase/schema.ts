import { Division, EventSpec, GameAssignment, GlobalPlayer, Player, ScoreRow, Team, Tournament } from "../models";

export const COLLECTIONS = {
  Tournaments: "tournaments",
  Divisions: "divisions",
  Events: "events",
  Players: "players",
  Scores: "scores",
  Assignments: "assignments",
  Teams: "teams",
  TeamMembers: "teamMembers",
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
  shortIdCounter: () => "system/shortIdCounter",
} as const;
