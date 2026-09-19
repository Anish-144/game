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

  /** Everything the declaring side has not banked is still up for grabs. */
  const opponentPool = Math.max(0, totalPoints - teamPoints);

  const onDeclaringSide = (playerId: string) => knownTeamIds.includes(playerId);

  /** The two numbers a seat shows: what they have, and out of what. */
  const scoreFor = (playerId: string) => {
    const declaring = onDeclaringSide(playerId);
    return {
      points: declaring && fullyRevealed ? teamPoints : pointsTaken[playerId] ?? 0,
      outOf: declaring ? s.highestBid : opponentPool,
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
  }, [s.players, s.myPlayerId, s.handCounts, s.declarerId, s.revealedPartners, s.phase, s.currentBidder, s.currentTurn, latestBid, pointsTaken, teamPoints, fullyRevealed, opponentPool, s.highestBid]);

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
    teamPoints, fullyRevealed, opponentPool, knownTeamIds, myScore,
    declarerName: nameOf(s.declarerId),
    bidderName: nameOf(s.currentBidder),
    turnName: nameOf(s.currentTurn),
  };
}
