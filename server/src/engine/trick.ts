// ============================================================
// Trick Engine — Kadi Teri v2
// ============================================================

import { Card, GameState, Rank, Suit, Trick } from '../types';
import { cardPoints, rankValue } from './deck';
import { updateOccurrences, checkPartnerReveal, findPartnerHolder } from './occurrence';

export interface PlayResult {
  valid: boolean;
  error?: string;
  trickComplete: boolean;
  trickWinnerId?: string;
  partnerRevealedPlayerId?: string; // playerId newly identified as partner
  roundComplete: boolean;
}

export function applyPlay(
  state: GameState,
  playerId: string,
  cardId: string
): PlayResult {
  if (state.phase !== 'playing') return err('Not in playing phase');
  if (state.currentTurn !== playerId) return err('Not your turn');

  const hand = state.hands[playerId];
  const cardIdx = hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return err('Card not in your hand');

  const card = hand[cardIdx];

  // Follow-suit validation
  const followErr = checkFollowSuit(state.currentTrick, hand, card);
  if (followErr) return err(followErr);

  // Remove from hand
  hand.splice(cardIdx, 1);

  // Add to trick
  if (state.currentTrick.plays.length === 0) {
    state.currentTrick.leadSuit = card.suit;
  }
  state.currentTrick.plays.push({ playerId, card });

  // Track occurrences
  const isDeclarerCard = playerId === state.declarerId;
  updateOccurrences(state, card, isDeclarerCard);

  // Check for partner reveal
  let partnerRevealedPlayerId: string | undefined;
  const match = checkPartnerReveal(state, card, playerId);
  if (match) {
    state.firedSpecs.push(match.index);
    const holder = findPartnerHolder(state, match.spec, playerId);
    if (!state.revealedPartners.includes(holder)) {
      state.revealedPartners.push(holder);
      state.newlyRevealedPartner = holder;
      partnerRevealedPlayerId = holder;
    }
  }

  // Check trick completion
  if (state.currentTrick.plays.length === state.players.length) {
    const winnerId = resolveTrick(state.currentTrick, state.trump!);
    state.currentTrick.winnerId = winnerId;

    const allCards = state.currentTrick.plays.map((p) => p.card);
    const pointCards = allCards.filter((c) => cardPoints(c) > 0);
    const points = pointCards.reduce((sum, c) => sum + cardPoints(c), 0);

    state.completedTricks.push({
      winnerId,
      cards: allCards,
      pointCards,
      points,
      plays: [...state.currentTrick.plays],
      leadSuit: state.currentTrick.leadSuit,
    });
    state.currentTrick = { plays: [], leadSuit: null, winnerId: null };
    state.currentLeader = winnerId;
    state.currentTurn = winnerId;

    // Round over when all hands empty
    const roundComplete = Object.values(state.hands).every((h) => h.length === 0);

    return {
      valid: true,
      trickComplete: true,
      trickWinnerId: winnerId,
      partnerRevealedPlayerId,
      roundComplete,
    };
  }

  state.currentTurn = nextPlayer(state, playerId);
  return { valid: true, trickComplete: false, partnerRevealedPlayerId, roundComplete: false };
}

export function resolveTrick(trick: Trick, trump: Suit): string {
  let best = trick.plays[0];
  for (let i = 1; i < trick.plays.length; i++) {
    if (beats(trick.plays[i].card, best.card, trick.leadSuit!, trump)) {
      best = trick.plays[i];
    }
  }
  return best.playerId;
}

export function beats(challenger: Card, current: Card, leadSuit: Suit, trump: Suit): boolean {
  const cTrump = challenger.suit === trump;
  const bTrump = current.suit === trump;
  if (cTrump && !bTrump) return true;
  if (!cTrump && bTrump) return false;
  if (cTrump && bTrump) return rankValue(challenger.rank) > rankValue(current.rank);
  // Neither trump
  const cLead = challenger.suit === leadSuit;
  const bLead = current.suit === leadSuit;
  if (cLead && !bLead) return true;
  if (!cLead && bLead) return false;
  if (cLead && bLead) return rankValue(challenger.rank) > rankValue(current.rank);
  return false; // both off-suit, can't win
}

export function checkFollowSuit(trick: Trick, hand: Card[], played: Card): string | null {
  if (trick.plays.length === 0) return null;
  const lead = trick.leadSuit!;
  const hasLead = hand.some((c) => c.suit === lead);
  if (hasLead && played.suit !== lead) return `Must follow suit: ${lead}`;
  return null;
}

function nextPlayer(state: GameState, currentId: string): string {
  const ids = state.players.map((p) => p.id);
  return ids[(ids.indexOf(currentId) + 1) % ids.length];
}

function err(message: string): PlayResult {
  return { valid: false, error: message, trickComplete: false, roundComplete: false };
}
