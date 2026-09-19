// ============================================================
// Bot Brain — Kadi Teri v3
// Pure decision functions. No sockets, no timers, no mutation
// of game state. Every decision uses only information a human
// in the same seat would have: their own hand plus public state.
// ============================================================

import {
  BotDifficulty, Card, GameState, Occurrence, PartnerCardSpec, Rank, Suit,
} from '../types';
import { cardPoints, rankValue, requiredPartnerCount } from './deck';
import { MIN_BID, BID_STEP, maxBid } from './bidding';
import { beats } from './trick';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

// ─── small helpers ────────────────────────────────────────────────────────────

function rnd(): number { return Math.random(); }
function pick<T>(arr: T[]): T { return arr[Math.floor(rnd() * arr.length)]; }
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
function bySuit(hand: Card[], suit: Suit): Card[] { return hand.filter((c) => c.suit === suit); }
function totalDeckPoints(state: GameState): number {
  return state.config.mode === 'classic' ? 250 : 500;
}

/** Cards a human would instinctively hold back because they are likely partner cards. */
function isLikelyPartnerCard(card: Card, trump: Suit | null): boolean {
  if (card.rank === '3' && card.suit === 'spades') return true;
  if (card.rank === 'A') return true;
  if (card.rank === 'K' && trump && card.suit === trump) return true;
  return false;
}

// ─── hand evaluation ──────────────────────────────────────────────────────────

/**
 * Rough trick-taking power of a hand, expressed as expected tricks won
 * divided by tricks available. Range roughly 0 to 1.
 */
export function controlScore(hand: Card[], trump: Suit | null): number {
  if (!hand.length) return 0;
  let power = 0;

  for (const c of hand) {
    const r = rankValue(c.rank); // 2 -> 0 ... A -> 12
    if (trump && c.suit === trump) power += 0.45 + r * 0.05;
    else if (r === 12) power += 0.75;        // Ace
    else if (r === 11) power += 0.45;        // King
    else if (r === 10) power += 0.22;        // Queen
    else if (r === 9) power += 0.10;         // Jack
  }

  // Short suits let you trump in.
  if (trump) {
    for (const s of SUITS) {
      if (s === trump) continue;
      const n = bySuit(hand, s).length;
      if (n === 0) power += 0.9;
      else if (n === 1) power += 0.4;
    }
  }

  return clamp(power / hand.length, 0, 1.2);
}

/** Points sitting in this hand right now. */
export function handPoints(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0);
}

/** Best trump suit for this hand, scored on length then high-card strength. */
export function bestTrump(hand: Card[]): Suit {
  let best: Suit = 'spades';
  let bestScore = -Infinity;
  for (const s of SUITS) {
    const cards = bySuit(hand, s);
    const score =
      cards.length * 10 +
      cards.reduce((n, c) => n + rankValue(c.rank), 0) +
      cards.reduce((n, c) => n + cardPoints(c) * 0.4, 0);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

/**
 * Points this bot expects its side to capture if it wins the contract.
 * Returns a value on the same scale as a bid.
 */
export function estimateTake(state: GameState, botId: string, trump: Suit | null): number {
  const hand = state.hands[botId] ?? [];
  const total = totalDeckPoints(state);
  const control = controlScore(hand, trump ?? bestTrump(hand));
  const share = handPoints(hand) / total;

  // Baseline 30% of points fall to the declaring side simply by having partners.
  const fraction = 0.30 + 0.52 * control + 0.45 * share;
  return clamp(Math.round(total * fraction), 0, Math.round(total * 0.88));
}

// ─── bidding ──────────────────────────────────────────────────────────────────

/** The highest number this bot is willing to say out loud. */
export function bidCeiling(state: GameState, botId: string, difficulty: BotDifficulty): number {
  const trump = bestTrump(state.hands[botId] ?? []);
  const raw = estimateTake(state, botId, trump);
  const cap = maxBid(state.config.mode);

  let ceiling: number;
  if (difficulty === 'easy') {
    ceiling = raw * (0.72 + rnd() * 0.36);
  } else if (difficulty === 'medium') {
    ceiling = raw * (0.92 + rnd() * 0.12);
  } else {
    // Hard bots push a little harder when few rivals remain.
    const active = state.players.filter((p) => !state.passedPlayers.has(p.id)).length;
    const pressure = active <= 2 ? 1.06 : 1.0;
    ceiling = raw * pressure;
  }
  return Math.floor(clamp(ceiling, 0, cap) / BID_STEP) * BID_STEP;
}

export function decideBid(
  state: GameState,
  botId: string,
  difficulty: BotDifficulty,
): number | 'pass' {
  const cap = maxBid(state.config.mode);
  const taken = new Set(
    state.bids.filter((b) => b.bid !== 'pass').map((b) => b.bid as number),
  );

  // Smallest legal raise that has not already been said.
  let next = Math.max(MIN_BID, state.highestBid + BID_STEP);
  next = Math.ceil(next / BID_STEP) * BID_STEP;
  while (taken.has(next) && next <= cap) next += BID_STEP;
  if (next > cap) return 'pass';

  // Easy bots fold on a coin flip even with a playable hand.
  if (difficulty === 'easy' && rnd() < 0.35) return 'pass';

  const ceiling = bidCeiling(state, botId, difficulty);
  if (next > ceiling) return 'pass';

  // Hard bots occasionally jump to shut the auction down.
  if (difficulty === 'hard' && ceiling - next >= 25 && rnd() < 0.3) {
    let jump = Math.min(ceiling, next + 15);
    jump = Math.floor(jump / BID_STEP) * BID_STEP;
    while (taken.has(jump) && jump < ceiling) jump += BID_STEP;
    if (!taken.has(jump) && jump <= cap && jump > state.highestBid) return jump;
  }

  return next;
}

// ─── trump ────────────────────────────────────────────────────────────────────

export function decideTrump(state: GameState, botId: string, difficulty: BotDifficulty): Suit {
  const hand = state.hands[botId] ?? [];
  if (difficulty === 'easy') {
    // Easy bots go with their longest suit, ignoring card quality.
    let best: Suit = 'spades'; let len = -1;
    for (const s of SUITS) {
      const n = bySuit(hand, s).length;
      if (n > len) { len = n; best = s; }
    }
    return best;
  }
  return bestTrump(hand);
}

// ─── partner selection ────────────────────────────────────────────────────────

interface PartnerCandidate {
  rank: Rank;
  suit: Suit;
  score: number;
  copiesHeld: number;
}

/**
 * Pick the partner cards. A good declarer asks for cards that are
 * powerful, that they do not already hold, and that sit in the suits
 * where they need help.
 */
export function decidePartners(
  state: GameState,
  botId: string,
  difficulty: BotDifficulty,
): PartnerCardSpec[] {
  const hand = state.hands[botId] ?? [];
  const trump = state.trump;
  const mode = state.config.mode;
  const copiesPerCard = mode === 'classic' ? 1 : 2;
  const required = requiredPartnerCount(mode, state.config.playerCount);

  const held = (rank: Rank, suit: Suit) =>
    hand.filter((c) => c.rank === rank && c.suit === suit).length;

  const candidates: PartnerCandidate[] = [];
  const ranks: Rank[] = ['A', 'K', 'Q', 'J', '10', '3'];

  for (const suit of SUITS) {
    for (const rank of ranks) {
      if (rank === '3' && suit !== 'spades') continue; // only the 3 of spades carries weight
      const copiesHeld = held(rank, suit);
      if (copiesHeld >= copiesPerCard) continue; // State C: illegal to request

      let score: number;
      if (rank === '3' && suit === 'spades') score = 34;   // the 30 point card
      else if (rank === 'A') score = 26;
      else if (rank === 'K') score = 20;
      else if (rank === 'Q') score = 14;
      else if (rank === 'J') score = 11;
      else score = 9;

      if (trump && suit === trump) score += 12;            // trump control matters most
      const suitLen = bySuit(hand, suit).length;
      if (suitLen <= 1) score += 5;                        // shore up a weak suit
      if (copiesHeld > 0) score -= 9;                      // State B is riskier

      candidates.push({ rank, suit, score, copiesHeld });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  let pool = candidates;
  if (difficulty === 'easy') pool = shuffle(candidates.slice(0, 14));
  else if (difficulty === 'medium') pool = shuffle(candidates.slice(0, 6)).concat(candidates.slice(6));

  const chosen: PartnerCandidate[] = [];
  const seen = new Set<string>();
  for (const c of pool) {
    const key = c.rank + '_' + c.suit;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(c);
    if (chosen.length === required) break;
  }

  return chosen.map<PartnerCardSpec>((c) => {
    const usesOtherCopy = mode === '500' && c.copiesHeld === 1;
    const occurrence: Occurrence =
      mode === 'classic' ? 'any' : usesOtherCopy ? 'first' : (rnd() < 0.75 ? 'first' : 'second');
    return { rank: c.rank, suit: c.suit, occurrence, usesOtherCopy };
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── card play ────────────────────────────────────────────────────────────────

/** Cards this bot is allowed to play right now. */
export function legalCards(state: GameState, botId: string): Card[] {
  const hand = state.hands[botId] ?? [];
  const lead = state.currentTrick.leadSuit;
  if (!lead) return hand;
  const following = hand.filter((c) => c.suit === lead);
  return following.length ? following : hand;
}

/** Public knowledge only: who is openly on the declaring side. */
function knownDeclarerSide(state: GameState): Set<string> {
  const s = new Set<string>();
  if (state.declarerId) s.add(state.declarerId);
  for (const id of state.revealedPartners) s.add(id);
  return s;
}

function isAlly(state: GameState, botId: string, otherId: string): boolean {
  if (botId === otherId) return true;
  const side = knownDeclarerSide(state);
  const meDeclaring = side.has(botId);
  const themDeclaring = side.has(otherId);
  // A bot only trusts a seat it can prove is on its side.
  return meDeclaring && themDeclaring;
}

function currentWinner(state: GameState): { playerId: string; card: Card } | null {
  const plays = state.currentTrick.plays;
  if (!plays.length) return null;
  const trump = state.trump!;
  const lead = state.currentTrick.leadSuit!;
  let best = plays[0];
  for (let i = 1; i < plays.length; i++) {
    if (beats(plays[i].card, best.card, lead, trump)) best = plays[i];
  }
  return best;
}

function trickPoints(state: GameState): number {
  return state.currentTrick.plays.reduce((n, p) => n + cardPoints(p.card), 0);
}

function lowestBy<T>(arr: T[], score: (t: T) => number): T {
  return arr.reduce((a, b) => (score(b) < score(a) ? b : a));
}
function highestBy<T>(arr: T[], score: (t: T) => number): T {
  return arr.reduce((a, b) => (score(b) > score(a) ? b : a));
}

/** How far through the round we are, 0 at the first trick and 1 at the last. */
function roundProgress(state: GameState, botId: string): number {
  const remaining = (state.hands[botId] ?? []).length;
  const played = state.completedTricks.length;
  const totalTricks = played + Math.max(remaining, 1);
  return played / totalTricks;
}

export function decideCard(state: GameState, botId: string, difficulty: BotDifficulty): Card {
  const options = legalCards(state, botId);
  if (options.length === 1) return options[0];
  if (difficulty === 'easy') return pick(options);

  const trump = state.trump!;
  const hand = state.hands[botId] ?? [];
  const leading = state.currentTrick.plays.length === 0;
  const hard = difficulty === 'hard';
  const progress = roundProgress(state, botId);

  // Hard bots hold likely partner cards back early so their side stays hidden.
  const bluffing = hard && progress < 0.35;
  const notBluffCards = options.filter((c) => !isLikelyPartnerCard(c, trump));
  const safeOptions = bluffing && notBluffCards.length ? notBluffCards : options;

  if (leading) return decideLead(safeOptions, trump, hand, hard);

  const best = currentWinner(state)!;
  const lead = state.currentTrick.leadSuit!;
  const pot = trickPoints(state);
  const allyWinning = isAlly(state, botId, best.playerId);
  const seatsAfterMe = state.players.length - state.currentTrick.plays.length - 1;

  const winners = safeOptions.filter((c) => beats(c, best.card, lead, trump));

  if (allyWinning) {
    // Feed points to a partner who is already winning, but only when the
    // trick is effectively safe, meaning nobody is left to overtake them.
    const safe = seatsAfterMe === 0;
    const pointCards = safeOptions.filter((c) => cardPoints(c) > 0);
    if ((safe || hard) && pointCards.length) {
      return highestBy(pointCards, (c) => cardPoints(c) * 10 - rankValue(c.rank));
    }
    return lowestBy(safeOptions, (c) => cardPoints(c) * 100 + rankValue(c.rank));
  }

  if (winners.length) {
    const worthIt = pot > 0 || seatsAfterMe === 0 || hard;
    if (worthIt) {
      // Take it with the cheapest card that still wins: prefer a non-point
      // winner, then the lowest rank.
      return lowestBy(winners, (c) => cardPoints(c) * 4 + rankValue(c.rank));
    }
  }

  // Cannot or should not win, so throw the least valuable card away.
  return lowestBy(safeOptions, (c) => cardPoints(c) * 100 + rankValue(c.rank));
}

function decideLead(
  options: Card[],
  trump: Suit,
  hand: Card[],
  hard: boolean,
): Card {
  const aces = options.filter((c) => c.rank === 'A' && c.suit !== trump);
  const trumps = options.filter((c) => c.suit === trump);
  const trumpLen = bySuit(hand, trump).length;

  // With a long, strong trump holding, pull trumps so the point cards
  // later in the round cannot be ruffed away.
  if (hard && trumpLen >= 4 && trumps.length) {
    const topTrump = highestBy(trumps, (c) => rankValue(c.rank));
    if (rankValue(topTrump.rank) >= 11) return topTrump;
  }

  // An off-suit Ace usually scoops whatever points land on it.
  if (aces.length) return pick(aces);

  // Otherwise lead something cheap and keep the point cards for later.
  const cheap = options.filter((c) => cardPoints(c) === 0);
  if (cheap.length) return highestBy(cheap, (c) => rankValue(c.rank));

  return lowestBy(options, (c) => cardPoints(c) * 100 + rankValue(c.rank));
}

/**
 * Thinking time, so bots do not act instantly and a person can follow
 * each card onto the table.
 */
export function thinkingDelay(
  difficulty: BotDifficulty,
  kind: 'bid' | 'trump' | 'partner' | 'play',
): number {
  const base = { bid: 1000, trump: 1500, partner: 1700, play: 1500 }[kind];
  const spread = difficulty === 'hard' ? 700 : 450;
  return base + Math.floor(rnd() * spread);
}
