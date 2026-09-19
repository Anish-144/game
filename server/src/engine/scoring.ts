// ============================================================
// Scoring Engine — Kadi Teri v2
// ============================================================

import { Card, GameState, PointBreakdownItem, Rank, ScoreResult, Suit } from '../types';
import { cardPoints } from './deck';

export function computeScore(state: GameState): ScoreResult {
  const declarerId = state.declarerId!;

  // Build declarer team from revealed partners
  const declarerTeamIds = new Set<string>([declarerId]);
  for (const pid of state.revealedPartners) {
    declarerTeamIds.add(pid);
  }
  const opponentTeamIds = state.players
    .map((p) => p.id)
    .filter((id) => !declarerTeamIds.has(id));

  let declarerPoints = 0;
  let opponentPoints = 0;

  // Aggregate point card breakdown
  const breakdown: Record<string, PointBreakdownItem> = {};

  for (const trick of state.completedTricks) {
    const isDeclarerTrick = declarerTeamIds.has(trick.winnerId);

    for (const card of trick.pointCards) {
      const pts = cardPoints(card);
      if (!pts) continue;

      if (isDeclarerTrick) declarerPoints += pts;
      else opponentPoints += pts;

      const key = `${card.rank}_${suitSymbol(card.suit)}`;
      if (!breakdown[key]) {
        breakdown[key] = {
          rank: card.rank,
          suit: card.suit,
          points: pts,
          count: 0,
          total: 0,
          winnerId: trick.winnerId,
        };
      }
      breakdown[key].count += 1;
      breakdown[key].total += pts;
    }
  }

  const bid = state.highestBid;
  const declarerWon = declarerPoints >= bid;

  return {
    declarerTeam: { playerIds: Array.from(declarerTeamIds), points: declarerPoints, won: declarerWon },
    opponentTeam: { playerIds: opponentTeamIds, points: opponentPoints, won: !declarerWon },
    bid,
    roundWinner: declarerWon ? 'declarer' : 'opponent',
    pointBreakdown: Object.values(breakdown).sort((a, b) => b.total - a.total),
    partnerCardsSelected: state.partnerSpecs,
    revealedPartners: state.revealedPartners,
    declarerId,
    trump: state.trump!,
  };
}

function suitSymbol(suit: string): string {
  const m: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  return m[suit] ?? suit;
}
