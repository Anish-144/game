// ============================================================
// Derived view of the game for the local player
// ============================================================

import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { pointsByPlayer, requiredPartnerCount, totalPointsFor } from '../lib/cards';
import type { Player } from '../types';
import type { SeatView } from '../components/game/Table';

export function useGame() {
  const s = useGameStore();

  const playerById = useMemo(() => {
    const map = new Map(s.players.map((p) => [p.id, p]));
    return (id: string): Player | undefined => map.get(id);
  }, [s.players]);

  const nameOf = (id: string | null | undefined): string =>
    (id ? playerById(id)?.name : undefined) ?? 'Player';

  const me = s.players.find((p) => p.id === s.myPlayerId) ?? null;
  const isMyTurn = s.currentTurn === s.myPlayerId;
  const isCurrentBidder = s.currentBidder === s.myPlayerId;
  const isDeclarer = s.declarerId === s.myPlayerId;
  const isHost = s.config?.hostId === s.myPlayerId;

  /** Latest bid each player made, for the seat badges. */
  const latestBid = useMemo(() => {
    const m = new Map<string, number | 'pass'>();
    for (const b of s.bids) m.set(b.playerId, b.bid);
    return m;
  }, [s.bids]);

  /** Points each player has captured, straight from the public trick log. */
  const pointsTaken = useMemo(
    () => pointsByPlayer(s.completedTricks),
    [s.completedTricks],
  );

  // ── how the running score is shown ───────────────────────────────
  // The declaring side is only ever summed once every partner has
  // revealed. Until then each seat carries its own points, so nobody
  // can work out a hidden partner from a team total.
  const totalPoints = s.config ? totalPointsFor(s.config.mode) : 250;

  /** Everyone the table can prove is on the declaring side. */
  const knownTeamIds = useMemo(
    () => [s.declarerId, ...s.revealedPartners].filter(Boolean) as string[],
    [s.declarerId, s.revealedPartners],
  );

  const teamPoints = useMemo(
    () => knownTeamIds.reduce((sum, id) => sum + (pointsTaken[id] ?? 0), 0),
    [knownTeamIds, pointsTaken],
  );

  /** True once every named partner card has been played and claimed. */
  const fullyRevealed =
    s.partnerSpecs.length > 0 && s.revealedPartners.length >= s.partnerSpecs.length;

  /**
   * What the opposition has to get past to sink the contract. Everything
   * the declaring side does not need is theirs to take, so this is fixed
   * for the whole round rather than drifting with each trick.
   */
  const opponentTarget = Math.max(0, totalPoints - s.highestBid);

  const onDeclaringSide = (playerId: string) => knownTeamIds.includes(playerId);

  /**
   * Once the last partner reveals, the opposition is known by elimination,
   * so both sides can be summed. Until then every seat shows only its own.
   */
  const oppositionPoints = useMemo(
    () => s.players
      .filter((p) => !knownTeamIds.includes(p.id))
      .reduce((sum, p) => sum + (pointsTaken[p.id] ?? 0), 0),
    [s.players, knownTeamIds, pointsTaken],
  );

  /** The two numbers a seat shows: what they have, and out of what. */
  const scoreFor = (playerId: string) => {
    const declaring = onDeclaringSide(playerId);
    const sided = declaring ? teamPoints : oppositionPoints;
    return {
      points: fullyRevealed ? sided : pointsTaken[playerId] ?? 0,
      outOf: declaring ? s.highestBid : opponentTarget,
      onDeclaringSide: declaring,
    };
  };

  /** Opponents in seating order, starting with the seat after mine. */
  const seats: SeatView[] = useMemo(() => {
    const list = [...s.players].sort((a, b) => a.seatIndex - b.seatIndex);
    const myIdx = list.findIndex((p) => p.id === s.myPlayerId);
    if (myIdx === -1) return [];
    const rotated = [...list.slice(myIdx + 1), ...list.slice(0, myIdx)];
    return rotated.map((player) => ({
      player,
      cardsLeft: s.handCounts[player.id] ?? 0,
      isDeclarer: player.id === s.declarerId,
      isPartner: s.revealedPartners.includes(player.id),
      isTurn: s.phase === 'bidding'
        ? s.currentBidder === player.id
        : s.currentTurn === player.id,
      bid: s.phase === 'bidding' || s.phase === 'trump_selection'
        ? latestBid.get(player.id) ?? null
        : null,
      ...scoreFor(player.id),
      showPoints: s.phase === 'playing' || s.phase === 'scoring',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.players, s.myPlayerId, s.handCounts, s.declarerId, s.revealedPartners, s.phase, s.currentBidder, s.currentTurn, latestBid, pointsTaken, teamPoints, oppositionPoints, fullyRevealed, opponentTarget, s.highestBid]);

  const partnersNeeded = s.config
    ? requiredPartnerCount(s.config.mode, s.config.playerCount)
    : 1;

  const myTricks = useMemo(
    () => s.completedTricks.filter((t) => t.winnerId === s.myPlayerId).length,
    [s.completedTricks, s.myPlayerId],
  );

  const myPoints = pointsTaken[s.myPlayerId] ?? 0;
  const myScore = scoreFor(s.myPlayerId);

  /** Do I hold one of the cards the declarer named? */
  const iHoldPartnerCard = useMemo(
    () => s.myHand.some((c) => s.partnerSpecs.some((p) => p.rank === c.rank && p.suit === c.suit)),
    [s.myHand, s.partnerSpecs],
  );

  return {
    me, isMyTurn, isCurrentBidder, isDeclarer, isHost,
    playerById, nameOf, seats, partnersNeeded, myTricks, myPoints,
    pointsTaken, iHoldPartnerCard,
    teamPoints, oppositionPoints, fullyRevealed, opponentTarget, knownTeamIds, myScore,
    declarerName: nameOf(s.declarerId),
    bidderName: nameOf(s.currentBidder),
    turnName: nameOf(s.currentTurn),
  };
}
