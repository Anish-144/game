// ============================================================
// Bot Driver — Kadi Teri v3
// Watches the engine and plays every bot seat that is on turn.
// One driver loop per room, guarded so two callers cannot race.
// ============================================================

import { Server } from 'socket.io';
import { BotDifficulty } from '../types';
import { Room } from '../rooms/room';
import {
  decideBid, decideCard, decidePartners, decideTrump, legalCards, thinkingDelay,
} from './botBrain';
import { BETWEEN_CARDS_MS } from './timing';
import {
  emitBidPassed, emitBidPlaced, emitBiddingComplete, emitCardPlayed,
  emitPartnersSelected, emitTrumpSelected, sendDeclarerHand,
} from '../socket/broadcast';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Rooms with a driver loop already running. */
const running = new Set<string>();

function difficultyOf(room: Room, botId: string): BotDifficulty {
  return room.players.find((p) => p.id === botId)?.difficulty ?? room.config.botDifficulty ?? 'medium';
}

function isBot(room: Room, playerId: string | null): boolean {
  if (!playerId) return false;
  return !!room.players.find((p) => p.id === playerId)?.isBot;
}

/**
 * Whose turn is it, and is that seat a bot?
 * Returns the bot id to act, or null when the game is waiting on a human.
 */
function nextBotToAct(room: Room): string | null {
  const engine = room.engine;
  if (!engine) return null;
  const s = engine.state;

  switch (s.phase) {
    case 'bidding':
      return isBot(room, s.currentBidder) ? s.currentBidder : null;
    case 'trump_selection':
    case 'partner_selection':
      return isBot(room, s.declarerId) ? s.declarerId : null;
    case 'playing':
      return isBot(room, s.currentTurn) ? s.currentTurn : null;
    default:
      return null;
  }
}

/**
 * Drive every consecutive bot action until a human is on turn.
 * Safe to call after any human action; a second call while the loop
 * is already running returns immediately.
 */
export function evaluateBots(io: Server, room: Room): void {
  if (running.has(room.code)) return;
  running.add(room.code);
  void driveLoop(io, room).finally(() => running.delete(room.code));
}

async function driveLoop(io: Server, room: Room): Promise<void> {
  // Hard stop so a bug in the engine cannot spin forever.
  for (let guard = 0; guard < 2000; guard++) {
    const engine = room.engine;
    if (!engine) return;

    const botId = nextBotToAct(room);
    if (!botId) return;

    const phase = engine.state.phase;
    const difficulty = difficultyOf(room, botId);
    const kind =
      phase === 'bidding' ? 'bid'
      : phase === 'trump_selection' ? 'trump'
      : phase === 'partner_selection' ? 'partner'
      : 'play';

    await wait(thinkingDelay(difficulty, kind) + (kind === 'play' ? BETWEEN_CARDS_MS : 0));

    // The table may still be showing a finished trick. Let people read it.
    const settle = (room.settleUntil ?? 0) - Date.now();
    if (settle > 0) await wait(settle + 250);

    // A human may have acted while this bot was thinking.
    if (!room.engine || room.engine !== engine) return;
    if (engine.state.phase !== phase) continue;
    if (nextBotToAct(room) !== botId) continue;

    const acted = act(io, room, botId, difficulty);
    if (!acted) return; // engine rejected the move; stop rather than spin
  }
}

function act(io: Server, room: Room, botId: string, difficulty: BotDifficulty): boolean {
  const engine = room.engine!;
  const state = engine.state;

  switch (state.phase) {
    case 'bidding': {
      const choice = decideBid(state, botId, difficulty);
      if (choice === 'pass') {
        const result = engine.passBid(botId);
        if (!result.valid) return false;
        emitBidPassed(io, room, botId);
        if (result.biddingComplete) {
          emitBiddingComplete(io, room, result.declarerId, result.winningBid);
          sendDeclarerHand(io, room);
        }
      } else {
        const result = engine.placeBid(botId, choice);
        if (!result.valid) {
          // Fall back to passing so the auction cannot stall.
          const fallback = engine.passBid(botId);
          if (!fallback.valid) return false;
          emitBidPassed(io, room, botId);
          if (fallback.biddingComplete) {
            emitBiddingComplete(io, room, fallback.declarerId, fallback.winningBid);
            sendDeclarerHand(io, room);
          }
          return true;
        }
        emitBidPlaced(io, room, botId, choice);
        if (result.biddingComplete) {
          emitBiddingComplete(io, room, result.declarerId, result.winningBid);
          sendDeclarerHand(io, room);
        }
      }
      return true;
    }

    case 'trump_selection': {
      const trump = decideTrump(state, botId, difficulty);
      const result = engine.selectTrump(botId, trump);
      if (!result.valid) return false;
      emitTrumpSelected(io, room, trump);
      return true;
    }

    case 'partner_selection': {
      const specs = decidePartners(state, botId, difficulty);
      const result = engine.selectPartners(botId, specs);
      if (!result.valid) return false;
      emitPartnersSelected(io, room, specs.length);
      return true;
    }

    case 'playing': {
      const card = decideCard(state, botId, difficulty);
      let chosen = card.id;
      let result = engine.playCard(botId, chosen);

      if (!result.valid) {
        // Never let a bad heuristic freeze the table: fall back to the
        // first card the rules allow.
        const fallback = legalCards(state, botId)[0];
        if (!fallback) return false;
        chosen = fallback.id;
        result = engine.playCard(botId, chosen);
        if (!result.valid) return false;
      }

      emitCardPlayed(io, room, botId, chosen, result);
      return true;
    }

    default:
      return false;
  }
}
