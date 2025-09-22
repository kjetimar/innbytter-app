import Dexie, { Table } from 'dexie';

export interface Team { id: string; name: string; createdAt: number; }
export interface Player { id: string; teamId: string; name: string; positions?: string[]; isActive: boolean; }
export interface Match {
  id: string; teamId: string; sport: 'football'|'handball'|'other';
  onFieldCount: number; halves: number; halfLengthMin: number;
  subIntervalMin: number; gamesInSeries: number;
  keeperRarity?: number;
  keeperIntervalMin?: number;
  keeperNamesRaw?: string;
  createdAt: number;
}
export interface PlanWindow { minute: number; ins: string[]; outs: string[]; }
export interface Plan { id: string; matchId: string; windows: PlanWindow[]; }
export interface Minutes { id: string; matchId: string; playerId: string; plannedMin: number; actualMin: number; }
export interface History { id: string; playerId: string; rollingMinutes: number; lastPosition?: string; }

export class DB extends Dexie {
  teams!: Table<Team, string>;
  players!: Table<Player, string>;
  matches!: Table<Match, string>;
  plans!: Table<Plan, string>;
  minutes!: Table<Minutes, string>;
  history!: Table<History, string>;
  constructor() {
    super('subsDB');
    this.version(1).stores({
      teams: 'id, name, createdAt',
      players: 'id, teamId, name, isActive',
      matches: 'id, teamId, createdAt',
      plans: 'id, matchId',
      minutes: 'id, matchId, playerId',
      history: 'id, playerId',
    });
  }
}

export const db = new DB();
