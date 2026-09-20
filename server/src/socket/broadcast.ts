// ============================================================
// Broadcast helpers — Kadi Teri v3
// One place that knows the wire format, shared by the human
// socket handlers and the bot driver so both emit identically.
// ============================================================

import { Server } from 'socket.io';
import { Player } from '../types';
import { Room } from '../rooms/room';
import { PlayResult } from '../engine/trick';
import { ROUND_END_MS, TRICK_SETTLE_MS } from '../engine/timing';

/** Strip socket ids before anything leaves the server. */
export function safePlayers(players: Player[]) {
  return players.map(
    ({ id, name, seatIndex, isReady, isConnected, isBot, difficulty, avatar, takenOver }) => ({
      id, name, seatIndex, isReady, isConnected, isBot, difficulty, avatar, takenOver: !!takenOver,
    }),
  );
}

/** Tell the table where an open end-of-game vote stands. */
export function emitEndVote(io: Server, room: Room): void {
  const vote = room.endVote;
  if (!vote) {
    io.to(room.code).emit('end-vote-closed', {});
    return;
  }
  const agreed = Object.values(vote.votes).filter(Boolean).length;
  io.to(room.code).emit('end-vote', {
    startedBy: vote.startedBy,
    startedByName: room.players.find((p) => p.id === vote.startedBy)?.name ?? 'Someone',
    votes: vote.votes,
    agreed,
    needed: vote.needed,
    eligible: vote.eligible,
  });
}

/** The round is over early. Everyone goes back to the lobby. */
export function emitGameStopped(io: Server, room: Room, reason: string): void {
  io.to(room.code).emit('game-stopped', {
    reason,
    players: safePlayers(room.players),
    config: room.config,
    roomCode: room.code,
  });
}

export function emitLobby(io: Server, room: Room): void {
  io.to(room.code).emit('lobby-update', {
    roomCode: room.code,
    players: safePlayers(room.players),
    config: room.config,
  });
}

/** Deal each human their private hand. Bots read theirs straight off the engine. */
export function sendHands(io: Server, room: Room): void {
  if (!room.engine) return;
  for (const p of room.players) {
    if (p.isBot) continue;
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('your-hand', { hand: room.engine.state.hands[p.id] ?? [] });
  }
}

export function emitGameStarted(io: Server, room: Room): void {
  if (!room.engine) return;
  const pub = room.engine.publicState();
  io.to(room.code).emit('game-started', { publicState: pub });
  sendHands(io, room);
  io.to(room.code).emit('bidding-started', {
    currentBidder: pub.currentBidder,
    highestBid: pub.highestBid,
  });
}

export function emitBidPlaced(io: Server, room: Room, playerId: string, bid: number): void {
  const pub = room.engine!.publicState();
  io.to(room.code).emit('bid-placed', {
    playerId,
    bid,
    currentBidder: pub.currentBidder,
    highestBid: pub.highestBid,
    bids: pub.bids,
  });
}

export function emitBidPassed(io: Server, room: Room, playerId: string): void {
  const pub = room.engine!.publicState();
  io.to(room.code).emit('bid-passed', {
    playerId,
    currentBidder: pub.currentBidder,
    highestBid: pub.highestBid,
    bids: pub.bids,
  });
}

export function emitBiddingComplete(
  io: Server, room: Room, declarerId?: string, winningBid?: number,
): void {
  io.to(room.code).emit('bidding-complete', { declarerId, winningBid });
}

export function emitTrumpSelected(io: Server, room: Room, trump: string): void {
  io.to(room.code).emit('trump-selected', { trump, phase: 'partner_selection' });
}

/** The declarer alone gets their own hand back, so they can pick partner cards. */
export function sendDeclarerHand(io: Server, room: Room): void {
  if (!room.engine) return;
  const declarerId = room.engine.state.declarerId;
  const declarer = room.players.find((p) => p.id === declarerId);
  if (!declarer || declarer.isBot) return;
  const s = io.sockets.sockets.get(declarer.socketId);
  if (s) s.emit('declarer-hand', { hand: room.engine.declarerHand() });
}

export function emitPartnersSelected(io: Server, room: Room, partnerCount: number): void {
  const pub = room.engine!.publicState();
  io.to(room.code).emit('partners-selected', {
    partnerCount,
    // The named cards are public now, so whoever holds one knows.
    partnerSpecs: pub.partnerSpecs,
    phase: pub.phase,
    currentTurn: pub.currentTurn,
    currentLeader: pub.currentLeader,
  });
}

export function emitCardPlayed(
  io: Server, room: Room, playerId: string, cardId: string, result: PlayResult,
): void {
  const engine = room.engine!;
  const pub = engine.publicState();
  const finished = result.trickComplete
    ? pub.completedTricks[pub.completedTricks.length - 1]
    : null;

  // On the closing card the engine has already swept the trick, so send
  // the finished trick instead of the empty one. Clients hold it on
  // screen until the trick-won that follows.
  io.to(room.code).emit('card-played', {
    playerId,
    cardId,
    currentTrick: finished
      ? { plays: finished.plays, leadSuit: finished.leadSuit, winnerId: finished.winnerId }
      : pub.currentTrick,
    currentTurn: pub.currentTurn,
    hands: pub.hands,
    trickComplete: !!finished,
    settleMs: finished ? TRICK_SETTLE_MS : 0,
  });

  if (result.partnerRevealedPlayerId) {
    io.to(room.code).emit('partner-revealed', {
      partnerId: result.partnerRevealedPlayerId,
      revealedPartners: pub.revealedPartners,
    });
  }

  if (!finished) {
    if (pub.phase === 'scoring') emitRoundFinished(io, room);
    return;
  }

  // Hold the table still while everyone reads the trick.
  room.settleUntil = Date.now() + TRICK_SETTLE_MS;
  const roundOver = result.roundComplete || pub.phase === 'scoring';

  setTimeout(() => {
    if (!room.engine) return;
    const now = room.engine.publicState();
    io.to(room.code).emit('trick-won', {
      winnerId: result.trickWinnerId,
      trickPoints: finished.points,
      completedTricks: now.completedTricks,
      currentTurn: now.currentTurn,
    });
    if (roundOver) setTimeout(() => emitRoundFinished(io, room), ROUND_END_MS);
  }, TRICK_SETTLE_MS);
}

export function emitRoundFinished(io: Server, room: Room): void {
  // The round can be torn down inside the end-of-round pause — a vote
  // passing, the table emptying — and this runs from a timer, so a
  // missing engine here would take the server down with it.
  if (!room.engine) return;
  const engine = room.engine;
  const score = engine.getScore();
  const pub = engine.publicState();
  const named = score
    ? {
        ...score,
        pointBreakdown: score.pointBreakdown.map((item) => ({
          ...item,
          winnerName: room.players.find((p) => p.id === item.winnerId)?.name,
        })),
      }
    : null;
  io.to(room.code).emit('round-finished', { score: named, publicState: pub });
}
