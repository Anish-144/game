// ============================================================
// Card presentation helpers
// ============================================================

import type { Card, GameMode, PartnerCardSpec, Rank, Suit } from '../types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_LABEL: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

/** Ink colour used on the face of a card. */
export const SUIT_INK: Record<Suit, string> = {
  spades: '#111827',
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#111827',
};

/** Accent colour used on badges and chips against the dark table. */
export const SUIT_ACCENT: Record<Suit, string> = {
  spades: '#e5e7eb',
  hearts: '#f87171',
  diamonds: '#fbbf24',
  clubs: '#6ee7b7',
};

export function cardPoints(card: Pick<Card, 'rank' | 'suit'>): number {
  if (card.rank === '3' && card.suit === 'spades') return 30;
  if (card.rank === 'A') return 10;
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J' || card.rank === '10') return 10;
  if (card.rank === '5') return 5;
  return 0;
}

export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank);
}

const SUIT_ORDER: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };

/** Sort a hand the way a player would fan it: by suit, then high to low. */
export function sortHand(hand: Card[], trump: Suit | null): Card[] {
  return [...hand].sort((a, b) => {
    const at = trump && a.suit === trump ? -1 : 0;
    const bt = trump && b.suit === trump ? -1 : 0;
    if (at !== bt) return at - bt;
    if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return rankValue(b.rank) - rankValue(a.rank);
  });
}

export function requiredPartnerCount(mode: GameMode, playerCount: number): number {
  if (mode === 'classic') return playerCount <= 5 ? 1 : 2;
  const table: Record<number, number> = { 4: 1, 5: 1, 6: 2, 7: 2, 8: 3, 9: 3, 10: 4 };
  return table[playerCount] ?? 1;
}

export function totalPointsFor(mode: GameMode): number {
  return mode === 'classic' ? 250 : 500;
}

export function maxBidFor(mode: GameMode): number {
  return mode === 'classic' ? 250 : 500;
}

export const MIN_BID = 125;
export const BID_STEP = 5;

/** Which suits are legal to follow given a lead suit. */
export function playableIds(hand: Card[], leadSuit: Suit | null): Set<string> {
  if (!leadSuit) return new Set(hand.map((c) => c.id));
  const following = hand.filter((c) => c.suit === leadSuit);
  const pool = following.length ? following : hand;
  return new Set(pool.map((c) => c.id));
}

/** Is this card one the declarer named as a partner card? */
export function isPartnerCard(
  card: Pick<Card, 'rank' | 'suit'>,
  specs: PartnerCardSpec[],
): boolean {
  return specs.some((s) => s.rank === card.rank && s.suit === card.suit);
}

/** Short label for a named partner card, e.g. "A♠" or "K♥ 2nd". */
export function partnerLabel(spec: PartnerCardSpec): string {
  const base = `${spec.rank}${SUIT_GLYPH[spec.suit]}`;
  if (spec.occurrence === 'any') return base;
  return `${base} ${spec.occurrence === 'first' ? '1st' : '2nd'}`;
}

/** Points each player has captured so far, from the public trick history. */
export function pointsByPlayer(
  tricks: { winnerId: string; pointCards: Pick<Card, 'rank' | 'suit'>[] }[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const trick of tricks) {
    const value = trick.pointCards.reduce((sum, c) => sum + cardPoints(c), 0);
    totals[trick.winnerId] = (totals[trick.winnerId] ?? 0) + value;
  }
  return totals;
}
