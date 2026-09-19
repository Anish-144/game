// ============================================================
// Bidding Engine — Kadi Teri v2
// Classic: min 125, max 250
// 500:     min 125, max 500
// ============================================================

import { BidEntry, GameMode, GameState } from '../types';

export const MIN_BID = 125;
export const BID_STEP = 5;
export function maxBid(mode: GameMode): number {
  return mode === 'classic' ? 250 : 500;
}

export interface BidResult {
  valid: boolean;
  error?: string;
  biddingComplete: boolean;
  declarerId?: string;
  winningBid?: number;
}

export function applyBid(state: GameState, playerId: string, bid: number): BidResult {
  if (state.phase !== 'bidding') return err('Not in bidding phase');
  if (state.currentBidder !== playerId) return err('Not your turn to bid');
  if (bid < MIN_BID) return err(`Minimum bid is ${MIN_BID}`);

  const max = maxBid(state.config.mode);
  if (bid > max) return err(`Maximum bid is ${max}`);
  if (bid % BID_STEP !== 0) return err(`Bid must be a multiple of ${BID_STEP}`);
  if (bid <= state.highestBid) return err(`Bid must exceed current ${state.highestBid}`);

  // No duplicate bid values
  const existingBidValues = state.bids
    .filter((b) => b.bid !== 'pass')
    .map((b) => b.bid as number);
  if (existingBidValues.includes(bid)) return err('That bid has already been placed');

  state.bids.push({ playerId, bid, timestamp: Date.now() });
  state.highestBid = bid;

  if (bid === max) {
    // Instant win
    state.declarerId = playerId;
    return { valid: true, biddingComplete: true, declarerId: playerId, winningBid: bid };
  }

  advanceBidder(state);
  return { valid: true, biddingComplete: false };
}

export function applyPass(state: GameState, playerId: string): BidResult {
  if (state.phase !== 'bidding') return err('Not in bidding phase');
  if (state.currentBidder !== playerId) return err('Not your turn to bid');

  state.bids.push({ playerId, bid: 'pass', timestamp: Date.now() });
  state.passedPlayers.add(playerId);

  const active = getActiveBidders(state);

  if (active.length === 1) {
    // Nobody ever bid — the last player standing takes the contract at the minimum.
    if (state.highestBid < MIN_BID) state.highestBid = MIN_BID;
    state.declarerId = active[0];
    return { valid: true, biddingComplete: true, declarerId: active[0], winningBid: state.highestBid };
  }

  if (active.length === 0) {
    // Defensive: everyone passed. Award to the first seat at the minimum bid.
    if (state.highestBid < MIN_BID) state.highestBid = MIN_BID;
    state.declarerId = state.players[0].id;
    return { valid: true, biddingComplete: true, declarerId: state.players[0].id, winningBid: state.highestBid };
  }

  advanceBidder(state);
  return { valid: true, biddingComplete: false };
}

export function initBidding(state: GameState): void {
  state.phase = 'bidding';
  state.bids = [];
  state.highestBid = MIN_BID - BID_STEP; // 120: first legal bid of 125 passes the > check
  state.declarerId = null;
  state.passedPlayers = new Set();
  state.currentBidder = state.players[0].id;
}

function getActiveBidders(state: GameState): string[] {
  return state.players.map((p) => p.id).filter((id) => !state.passedPlayers.has(id));
}

function advanceBidder(state: GameState): void {
  const ids = state.players.map((p) => p.id);
  const active = new Set(getActiveBidders(state));
  const cur = ids.indexOf(state.currentBidder!);
  for (let offset = 1; offset <= ids.length; offset++) {
    const next = ids[(cur + offset) % ids.length];
    if (active.has(next)) { state.currentBidder = next; return; }
  }
  state.currentBidder = null;
}

function err(message: string): BidResult {
  return { valid: false, error: message, biddingComplete: false };
}
