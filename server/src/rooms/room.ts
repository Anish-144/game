// ============================================================
// Room Model — Kadi Teri v3
// The host is ALWAYS seated inside the room at creation time.
// ============================================================

import { BotDifficulty, EndVote, Player, RoomConfig } from '../types';
import { GameEngine } from '../engine/engine';

export interface Room {
  code: string;
  config: RoomConfig;
  players: Player[];
  engine: GameEngine | null;
  createdAt: number;
  lastActivity: number;
  /** While this is in the future the table is showing a finished trick. */
  settleUntil?: number;
  /** How many people were at the table when the deal started. */
  humansAtStart?: number;
  /** An open vote to end the game early. */
  endVote?: EndVote;
}

const rooms = new Map<string, Room>();

const BOT_NAMES = [
  'Alpha', 'Bravo', 'Cobra', 'Delta', 'Echo', 'Falcon',
  'Ghost', 'Hydra', 'Indigo', 'Jaguar', 'Kestrel', 'Lynx',
];

export function createRoom(code: string, config: RoomConfig, host: Player): Room {
  host.seatIndex = 0;
  const room: Room = {
    code,
    config,
    players: [host],
    engine: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  const room = rooms.get(code?.toUpperCase?.() ?? code);
  if (room) room.lastActivity = Date.now();
  return room;
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

export function roomExists(code: string): boolean {
  return rooms.has(code);
}

export function humanSlotsLeft(room: Room): number {
  return room.config.playerCount - room.players.length;
}

export function addPlayer(room: Room, player: Player): boolean {
  if (room.players.length >= room.config.playerCount) return false;
  player.seatIndex = room.players.length;
  room.players.push(player);
  return true;
}

/** Seat one bot. Returns the created bot, or null when the room is full. */
export function addBot(room: Room, difficulty: BotDifficulty): Player | null {
  if (room.players.length >= room.config.playerCount) return null;

  const used = new Set(room.players.filter((p) => p.isBot).map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.players.length + 1}`;
  const bot: Player = {
    id: `bot-${Math.random().toString(36).slice(2, 9)}`,
    socketId: '',
    name,
    seatIndex: room.players.length,
    isReady: true,
    isConnected: true,
    isBot: true,
    difficulty,
    avatar: (room.players.length * 3 + 5) % 12,
  };
  room.players.push(bot);
  return bot;
}

/** Remove one bot by id (or the last bot when no id is given). */
export function removeBot(room: Room, botId?: string): boolean {
  const idx = botId
    ? room.players.findIndex((p) => p.isBot && p.id === botId)
    : findLastIndex(room.players, (p) => p.isBot);
  if (idx === -1) return false;
  room.players.splice(idx, 1);
  reseat(room);
  return true;
}

export function removePlayer(room: Room, playerId: string): boolean {
  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return false;
  room.players.splice(idx, 1);
  reseat(room);
  return true;
}

function reseat(room: Room): void {
  room.players.forEach((p, i) => (p.seatIndex = i));
}

function findLastIndex<T>(arr: T[], fn: (t: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return i;
  return -1;
}

export function isFull(room: Room): boolean {
  return room.players.length === room.config.playerCount;
}

/**
 * A seat that belongs to a person rather than to a bot from the start.
 * A seat a bot is covering still belongs to whoever left it, which
 * matters the moment they come back.
 */
export function isPersonsSeat(player: Player): boolean {
  return !player.isBot || !!player.takenOver;
}

/**
 * The people actually at the table right now. Someone who refreshed and
 * came back counts, even though a bot finishes the round in their seat,
 * or the table could be closed out from under them.
 */
export function humansPresent(room: Room): Player[] {
  return room.players.filter((p) => p.isConnected && isPersonsSeat(p));
}

/** Hand a seat to a bot so a round can finish without the person. */
export function handSeatToBot(room: Room, player: Player, difficulty: BotDifficulty): void {
  if (player.isBot) return;
  player.isBot = true;
  player.takenOver = true;
  player.difficulty = difficulty;
}

/** Give every taken-over seat back before the next deal. */
export function restoreTakenOverSeats(room: Room): Player[] {
  const restored: Player[] = [];
  for (const p of room.players) {
    if (!p.takenOver) continue;
    p.takenOver = false;
    p.isBot = false;
    p.difficulty = undefined;
    restored.push(p);
  }
  return restored;
}

/** Clear the round so the table can go back to the lobby. */
export function endGame(room: Room): void {
  room.engine = null;
  room.endVote = undefined;
  room.settleUntil = undefined;
  room.humansAtStart = undefined;

  // A seat only a bot was holding belonged to someone who walked away.
  // Free it rather than pretending they are still at the table.
  const abandoned = room.players.filter((p) => p.takenOver && !p.isConnected);
  for (const p of abandoned) removePlayer(room, p.id);
  restoreTakenOverSeats(room);
}

export function startGame(room: Room): GameEngine {
  restoreTakenOverSeats(room);
  room.endVote = undefined;
  room.humansAtStart = room.players.filter((p) => !p.isBot).length;
  const engine = new GameEngine(room.config, room.players);
  room.engine = engine;
  engine.startGame();
  return engine;
}

export function cleanupStaleRooms(): void {
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.lastActivity < cutoff) rooms.delete(code);
  }
}

export function allRoomCodes(): string[] {
  return Array.from(rooms.keys());
}
