// ============================================================
// Occurrence Engine — Kadi Teri v3
// Tracks how many times each rank+suit has been played, with a
// separate counter that excludes the declarer's own copies.
// ============================================================

import { Card, GameState, PartnerCardSpec } from '../types';

/** Key for occurrence tracking */
export function occKey(card: Card): string {
  return `${card.rank}_${card.suit}`;
}

/**
 * Update occurrence counters when a card is played.
 * @param isDeclarerCard true if the card being played belongs to the declarer
 */
export function updateOccurrences(
  state: GameState,
  card: Card,
  isDeclarerCard: boolean,
): void {
  const key = occKey(card);
  state.occurrenceCounts[key] = (state.occurrenceCounts[key] ?? 0) + 1;

  if (!isDeclarerCard) {
    state.otherOccurrenceCounts[key] = (state.otherOccurrenceCounts[key] ?? 0) + 1;
  }
}

export interface PartnerMatch {
  spec: PartnerCardSpec;
  index: number;
}

/**
 * Check whether the played card satisfies a partner spec that has not
 * already been claimed.
 *
 * Rules:
 *  - Classic (occurrence='any'): the first play of the named card reveals
 *  - 500 (occurrence='first'|'second'):
 *    - usesOtherCopy=false: count every play of that card
 *    - usesOtherCopy=true:  count only plays that are not the declarer's own copy
 *
 * A spec fires at most once. Without that guard the counter stays parked on
 * its target value, so a later play of the same card would reveal a second,
 * wrong player — including the declarer themselves.
 */
export function checkPartnerReveal(
  state: GameState,
  card: Card,
  playerId: string,
): PartnerMatch | null {
  const key = occKey(card);

  for (let index = 0; index < state.partnerSpecs.length; index++) {
    if (state.firedSpecs.includes(index)) continue;

    const spec = state.partnerSpecs[index];
    if (spec.rank !== card.rank || spec.suit !== card.suit) continue;

    // The declarer can never be their own partner.
    if (playerId === state.declarerId) continue;

    if (spec.occurrence === 'any') {
      if ((state.occurrenceCounts[key] ?? 0) === 1) return { spec, index };
      continue;
    }

    const target = spec.occurrence === 'first' ? 1 : 2;
    const counter = spec.usesOtherCopy
      ? state.otherOccurrenceCounts[key] ?? 0
      : state.occurrenceCounts[key] ?? 0;

    if (counter === target) return { spec, index };
  }

  return null;
}

/**
 * Which player holds the matching partner card.
 * The player who just played it is the partner.
 */
export function findPartnerHolder(
  _state: GameState,
  _spec: PartnerCardSpec,
  playedByPlayerId: string,
): string {
  return playedByPlayerId;
}
