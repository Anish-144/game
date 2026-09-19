// ============================================================
// Deck Engine — Kadi Teri v2
// Classic: 52 cards (1 copy each)
// 500:    104 cards (2 copies, ids A_spades_1, A_spades_2)
// Point system: 3♠=30, A=10, K=10, Q=10, J=10, 10=10, 5=5
// ============================================================

import { Card, GameMode, Rank, Suit } from '../types';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Point value for a single card */
export function cardPoints(card: Card): number {
  if (card.rank === '3' && card.suit === 'spades') return 30;
  if (card.rank === 'A') return 10;
  if (['K', 'Q', 'J', '10'].includes(card.rank)) return 10;
  if (card.rank === '5') return 5;
  return 0;
}

/** Build a complete single deck */
function buildSingleDeck(copy: 1 | 2): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const suffix = copy === 1 ? '' : '_2';
      const id = copy === 1 ? `${rank}_${suit}` : `${rank}_${suit}_${copy}`;
      deck.push({ id, rank, suit, copy });
    }
  }
  return deck;
}

/** Build the full deck(s) for a given mode */
function buildRawDeck(mode: GameMode): Card[] {
  if (mode === 'classic') return buildSingleDeck(1);
  // 500: two copies with _1 and _2 IDs
  const d1 = buildSingleDeck(1);
  const d2: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      d2.push({ id: `${rank}_${suit}_2`, rank, suit, copy: 2 });
    }
  }
  return [...d1, ...d2];
}

/** Whether a card is protected from removal */
function isProtected(card: Card): boolean {
  if (card.rank === '3' && card.suit === 'spades') return true;
  if (card.rank === '5') return true;
  if (card.rank === '10') return true;
  if (['J', 'Q', 'K'].includes(card.rank)) return true;
  if (card.rank === 'A') return true; // Aces are now point cards
  return false;
}

/** Removal priority (lowest-value non-point cards first) */
const REMOVAL_PRIORITY: Rank[] = ['2', '4', '6', '7', '8', '9'];

/** Remove `count` non-point cards from the deck */
function removeCards(deck: Card[], count: number): Card[] {
  let removed = 0;
  const result = [...deck];

  for (const rank of REMOVAL_PRIORITY) {
    if (removed >= count) break;
    // Remove from the end to preserve card order
    for (let i = result.length - 1; i >= 0 && removed < count; i--) {
      if (result[i].rank === rank && !isProtected(result[i])) {
        result.splice(i, 1);
        removed++;
      }
    }
  }

  if (removed < count) {
    // Last resort: try removing Aces
    for (let i = result.length - 1; i >= 0 && removed < count; i--) {
      if (result[i].rank === 'A') {
        result.splice(i, 1);
        removed++;
      }
    }
  }

  return result;
}

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build, trim, and shuffle a deck for the given mode + player count.
 */
export function buildDeck(mode: GameMode, playerCount: number): Card[] {
  const raw = buildRawDeck(mode);
  const target = Math.floor(raw.length / playerCount) * playerCount;
  const toRemove = raw.length - target;

  const trimmed = toRemove > 0 ? removeCards(raw, toRemove) : raw;
  return shuffle(trimmed);
}

/**
 * Deal cards evenly to all players.
 */
export function deal(deck: Card[], playerIds: string[]): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {};
  playerIds.forEach((id) => (hands[id] = []));
  const perPlayer = Math.floor(deck.length / playerIds.length);
  deck.forEach((card, i) => {
    const owner = playerIds[i % playerIds.length];
    if (hands[owner].length < perPlayer) hands[owner].push(card);
  });
  return hands;
}

/** Sanity-check total points */
export function totalPoints(deck: Card[]): number {
  return deck.reduce((s, c) => s + cardPoints(c), 0);
}

/** Number of partner cards required based on mode + player count */
export function requiredPartnerCount(mode: GameMode, playerCount: number): number {
  if (mode === 'classic') {
    return playerCount <= 5 ? 1 : 2;
  }
  // 500 Edition
  const table: Record<number, number> = { 4: 1, 5: 1, 6: 2, 7: 2, 8: 3, 9: 3, 10: 4 };
  return table[playerCount] ?? 1;
}

/** Card rank value for comparison */
const RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}
