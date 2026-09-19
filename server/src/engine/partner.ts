// ============================================================
// Partner Engine — Kadi Teri v2
// Validates partner spec selections from the declarer.
// Determines State A / B / C based on declarer's hand.
// ============================================================

import { Card, GameState, GameMode, PartnerCardSpec, Rank, Suit } from '../types';
import { requiredPartnerCount } from './deck';

export type PartnerState = 'A' | 'B' | 'C';

interface CardGroupKey { rank: Rank; suit: Suit }

/**
 * Count how many copies of a specific rank+suit the declarer holds.
 */
export function countDeclarerCopies(
  declarerHand: Card[],
  rank: Rank,
  suit: Suit
): number {
  return declarerHand.filter((c) => c.rank === rank && c.suit === suit).length;
}

/**
 * Determine the partner state for a given card from the declarer's perspective.
 */
export function getPartnerState(
  declarerHand: Card[],
  rank: Rank,
  suit: Suit
): PartnerState {
  const copies = countDeclarerCopies(declarerHand, rank, suit);
  if (copies === 0) return 'A';
  if (copies === 1) return 'B';
  return 'C'; // copies === 2 (500 mode only)
}

/**
 * Validate the partner specs submitted by the declarer.
 * Returns null if valid, or an error string.
 */
export function validatePartnerSpecs(
  state: GameState,
  playerId: string,
  specs: PartnerCardSpec[]
): string | null {
  if (playerId !== state.declarerId) return 'Only the declarer can select partners';
  if (state.phase !== 'partner_selection') return 'Wrong game phase';

  const required = requiredPartnerCount(state.config.mode, state.config.playerCount);
  if (specs.length !== required) return `Must select exactly ${required} partner card(s)`;

  const declarerHand = state.hands[playerId];
  const mode = state.config.mode;

  for (const spec of specs) {
    const pState = getPartnerState(declarerHand, spec.rank, spec.suit);

    if (pState === 'C') {
      return `You hold both copies of ${spec.rank} of ${spec.suit} — cannot select as partner`;
    }

    if (pState === 'B') {
      // Must set usesOtherCopy = true
      if (!spec.usesOtherCopy) {
        spec.usesOtherCopy = true; // auto-correct
      }
    }

    if (mode === 'classic') {
      // Classic: only 1 copy exists per card, occurrence is irrelevant
      spec.occurrence = 'any';
      spec.usesOtherCopy = false;
    } else {
      // 500 mode: occurrence must be 'first' or 'second'
      if (spec.occurrence === 'any') {
        spec.occurrence = 'first'; // default
      }
    }
  }

  // No duplicate rank+suit selections (with different occurrences in 500)
  const seen = new Set<string>();
  for (const spec of specs) {
    const key = `${spec.rank}_${spec.suit}_${spec.occurrence}`;
    if (seen.has(key)) return 'Duplicate partner card selection';
    seen.add(key);
  }

  return null;
}
