// ============================================================
// Socket client — Kadi Teri v3
// One connection, listeners bound once, typed emit helpers.
// ============================================================

import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import { forgetRoom, getAvatar, getPlayerId, getPlayerName, lastRoom } from './identity';
import { play } from './audio';
import { buzz } from './haptics';
import type {
  BotDifficulty, PartnerCardSpec, RoomSetup, Suit,
} from '../types';

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

let socket: Socket | null = null;
let bound = false;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 600,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

const store = () => useGameStore.getState();

const SUIT_MARK: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

function nameOf(playerId: string | null | undefined): string {
  if (!playerId) return 'Someone';
  return store().players.find((p) => p.id === playerId)?.name ?? 'Someone';
}

/** Attach every game listener. Safe to call more than once. */
export function bindSocket(): Socket {
  const s = getSocket();
  if (bound) return s;
  bound = true;

  // Give the rejoin a few seconds, then stop holding the screen hostage.
  if (store().rejoining) window.setTimeout(() => store().setRejoining(false), 8000);

  s.on('connect', () => {
    store().setConnected(true);
    // Re-seat this device if it was already in a room, including after a refresh.
    const { roomCode, myPlayerId } = store();
    const code = roomCode ?? lastRoom();
    if (code) s.emit('reconnect-player', { playerId: myPlayerId, roomCode: code });
  });

  s.on('disconnect', () => store().setConnected(false));
  s.on('connect_error', () => store().setConnected(false));

  // ── room ────────────────────────────────────────────────
  s.on('room-created', (d) => {
    store().setRoom(d.roomCode, d.players, d.config);
    play('join');
  });

  s.on('room-joined', (d) => {
    store().setRoom(d.roomCode, d.players, d.config);
    play('join');
  });

  s.on('lobby-update', (d) => {
    const before = store().players.length;
    store().setPlayers(d.players);
    if (d.config) store().setConfig(d.config);
    if (d.players.length > before) { play('join'); buzz('light'); }
  });

  s.on('invite', (d) => {
    store().setInvite({ roomCode: d.roomCode, link: d.link, seatsLeft: d.seatsLeft });
  });

  s.on('player-left', (d) => {
    store().pushBanner('info', `${nameOf(d.playerId)} left the table`);
  });

  s.on('player-disconnected', (d) => {
    store().pushBanner('info', `${nameOf(d.playerId)} lost connection`);
  });

  s.on('player-reconnected', (d) => {
    store().pushBanner('info', `${nameOf(d.playerId)} is back`);
  });

  // ── deal ────────────────────────────────────────────────
  s.on('game-started', (d) => {
    store().applyPublicState(d.publicState);
    play('deal');
    buzz('medium');
  });

  s.on('your-hand', (d) => store().setMyHand(d.hand));
  s.on('declarer-hand', (d) => store().setDeclarerHand(d.hand));

  // ── bidding ─────────────────────────────────────────────
  s.on('bidding-started', (d) => {
    store().setBidding({ currentBidder: d.currentBidder, highestBid: d.highestBid });
    store().setPhase('bidding');
  });

  s.on('bid-placed', (d) => {
    store().setBidding({ currentBidder: d.currentBidder, highestBid: d.highestBid, bids: d.bids });
    play('bid');
  });

  s.on('bid-passed', (d) => {
    store().setBidding({ currentBidder: d.currentBidder, bids: d.bids });
    play('pass');
  });

  s.on('bidding-complete', (d) => {
    store().setDeclarer(d.declarerId, d.winningBid);
    store().pushBanner('info', `${nameOf(d.declarerId)} takes the contract at ${d.winningBid}`);
    buzz('success');
  });

  // ── trump + partners ────────────────────────────────────
  s.on('trump-selected', (d) => {
    store().setTrump(d.trump as Suit);
    play('trump');
  });

  s.on('partners-selected', (d) => {
    if (d.partnerSpecs) store().setPartnerSpecs(d.partnerSpecs);
    store().setPhase(d.phase);
    store().setCurrentTurn(d.currentTurn);
    if (d.partnerSpecs?.length) {
      const names = d.partnerSpecs
        .map((p: { rank: string; suit: string }) => `${p.rank}${SUIT_MARK[p.suit] ?? ''}`)
        .join('  ');
      store().pushBanner('reveal', `Partner card${d.partnerSpecs.length > 1 ? 's' : ''}: ${names}`);
    }
  });

  // ── play ────────────────────────────────────────────────
  s.on('card-played', (d) => {
    store().setHandCounts(d.hands);
    store().removeFromMyHand(d.cardId);
    play('play');

    if (d.trickComplete) {
      // Hold the full trick on screen so the closing card is readable.
      store().holdTrick(d.currentTrick);
      buzz('light');
      return;
    }
    store().setCurrentTrick(d.currentTrick);
    store().setCurrentTurn(d.currentTurn);
  });

  s.on('partner-revealed', (d) => {
    store().addRevealedPartner(d.partnerId, d.revealedPartners);
    store().pushBanner('reveal', `${nameOf(d.partnerId)} is a partner`);
    play('reveal');
    buzz('success');
  });

  s.on('trick-won', (d) => {
    const pts = d.trickPoints ?? 0;
    store().finishTrick(d.winnerId, d.completedTricks, d.currentTurn);
    store().pushBanner(
      'trick',
      pts > 0
        ? `${nameOf(d.winnerId)} takes the trick, ${pts} points`
        : `${nameOf(d.winnerId)} takes the trick`,
    );
    play('trick');
  });

  // ── scoring ─────────────────────────────────────────────
  s.on('round-finished', (d) => {
    if (d.score) store().setScore(d.score);
    store().applyPublicState(d.publicState);
    store().setPhase('scoring');
  });

  // ── reconnect ───────────────────────────────────────────
  s.on('reconnected', (d) => {
    store().setRejoining(false);
    if (d.roomCode || d.config?.roomCode) {
      const code = d.roomCode ?? d.config.roomCode;
      store().setRoom(code, d.players ?? store().players, d.config ?? store().config);
    }
    if (d.state) {
      store().applyPublicState(d.state);
      if (d.state.myHand) store().setMyHand(d.state.myHand);
    }
    if (d.players) store().setPlayers(d.players);
    if (d.config) store().setConfig(d.config);
  });

  // ── errors ──────────────────────────────────────────────
  s.on('error', (d: { message: string }) => {
    const message = d?.message ?? 'Something went wrong';
    // A stale remembered room should not keep re-triggering a failed rejoin.
    if (/room has closed|not seated|no room with that code/i.test(message)) {
      forgetRoom();
      store().setRejoining(false);
    }
    store().setError(message);
    store().pushBanner('error', message);
    buzz('warning');
  });

  return s;
}

// ─── emit helpers ─────────────────────────────────────────────────────────────

function me() {
  return {
    playerId: getPlayerId(),
    playerName: store().myPlayerName || getPlayerName(),
    avatar: store().myAvatar ?? getAvatar(),
  };
}

export function createRoom(setup: RoomSetup): void {
  const { playerId, playerName, avatar } = me();
  bindSocket().emit('create-room', {
    playerId,
    playerName,
    avatar,
    mode: setup.mode,
    playerCount: setup.playerCount,
    matchType: setup.matchType,
    botCount: setup.botCount,
    botDifficulty: setup.botDifficulty,
  });
}

export function joinRoom(roomCode: string): void {
  const { playerId, playerName, avatar } = me();
  bindSocket().emit('join-room', { playerId, playerName, avatar, roomCode });
}

export function addBot(difficulty?: BotDifficulty): void {
  const { roomCode, myPlayerId, config } = store();
  if (!roomCode) return;
  getSocket().emit('add-bot', {
    roomCode,
    playerId: myPlayerId,
    difficulty: difficulty ?? config?.botDifficulty ?? 'medium',
  });
}

export function removeBot(botId: string): void {
  const { roomCode, myPlayerId } = store();
  if (!roomCode) return;
  getSocket().emit('remove-bot', { roomCode, playerId: myPlayerId, botId });
}

export function startGame(): void {
  const { roomCode, myPlayerId } = store();
  if (!roomCode) return;
  getSocket().emit('start-game', { roomCode, playerId: myPlayerId });
}

export function requestInvite(): void {
  const { roomCode } = store();
  if (!roomCode) return;
  getSocket().emit('share-invite', { roomCode, origin: window.location.origin });
}

export function placeBid(bid: number): void {
  const { roomCode, myPlayerId } = store();
  getSocket().emit('place-bid', { roomCode, playerId: myPlayerId, bid });
}

export function passBid(): void {
  const { roomCode, myPlayerId } = store();
  getSocket().emit('pass', { roomCode, playerId: myPlayerId });
}

export function selectTrump(trump: Suit): void {
  const { roomCode, myPlayerId } = store();
  getSocket().emit('select-trump', { roomCode, playerId: myPlayerId, trump });
}

export function selectPartners(partnerSpecs: PartnerCardSpec[]): void {
  const { roomCode, myPlayerId } = store();
  getSocket().emit('select-partners', { roomCode, playerId: myPlayerId, partnerSpecs });
}

export function playCard(cardId: string): void {
  const { roomCode, myPlayerId } = store();
  getSocket().emit('play-card', { roomCode, playerId: myPlayerId, cardId });
}

export function leaveRoom(): void {
  const s = getSocket();
  s.emit('leave-room');
  store().leaveRoom();
}
