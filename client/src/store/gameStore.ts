// ============================================================
// Game store — Kadi Teri v3
// ============================================================

import { create } from 'zustand';
import type {
  BidEntry, Card, CompletedTrick, EndVote, GamePhase, PartnerCardSpec, Player,
  PublicGameState, RoomConfig, ScoreResult, Suit, TeamPoints, Trick, ChatMessage, PlayerEmoteMessage,
} from '../types';
import { forgetRoom, getAvatar, getPlayerId, getPlayerName, lastRoom, rememberRoom } from '../lib/identity';

const EMPTY_TRICK: Trick = { plays: [], leadSuit: null, winnerId: null };

interface Banner {
  id: number;
  kind: 'info' | 'error' | 'reveal' | 'trick';
  text: string;
}

interface GameState {
  // identity
  myPlayerId: string;
  myPlayerName: string;
  myAvatar: number;

  // room
  roomCode: string | null;
  config: RoomConfig | null;
  players: Player[];
  connected: boolean;

  // phase
  phase: GamePhase;

  // hands
  myHand: Card[];
  handCounts: Record<string, number>;
  declarerHand: Card[];

  // bidding
  bids: BidEntry[];
  currentBidder: string | null;
  highestBid: number;
  declarerId: string | null;
  passedPlayers: string[];

  // trump + partners
  trump: Suit | null;
  /** The cards the declarer named. Public once chosen. */
  partnerSpecs: PartnerCardSpec[];
  revealedPartners: string[];

  // play
  currentTrick: Trick;
  lastTrick: CompletedTrick | null;
  completedTricks: CompletedTrick[];
  currentLeader: string | null;
  currentTurn: string | null;
  /** True while a finished trick is being held on screen. */
  settling: boolean;
  trickWinnerId: string | null;
  lastTrickPoints: number;

  // scoring
  score: ScoreResult | null;
  teamPoints: TeamPoints | null;
  roundWinner: 'declarer' | 'opponent' | null;

  // invite
  invite: { roomCode: string; link: string; seatsLeft: number } | null;

  /** An open vote to end the game, or null when there is none. */
  endVote: EndVote | null;
  /** Why the last game stopped early, shown once back in the lobby. */
  stoppedReason: string | null;

  banners: Banner[];
  error: string | null;
  errorNonce: number;
  rejoining: boolean;

  // chat
  chat: ChatMessage[];
  unreadChat: boolean;

  // emotes
  emotes: PlayerEmoteMessage[];
}

interface GameActions {
  setIdentity: (name: string, avatar: number) => void;
  setConnected: (connected: boolean) => void;
  setRoom: (roomCode: string, players: Player[], config: RoomConfig) => void;
  setPlayers: (players: Player[]) => void;
  setConfig: (config: RoomConfig) => void;
  setPhase: (phase: GamePhase) => void;
  setMyHand: (hand: Card[]) => void;
  removeFromMyHand: (cardId: string) => void;
  setHandCounts: (counts: Record<string, number>) => void;
  setDeclarerHand: (hand: Card[]) => void;
  addBid: (entry: BidEntry) => void;
  setBidding: (p: { currentBidder?: string | null; highestBid?: number; bids?: BidEntry[] }) => void;
  setDeclarer: (id: string | null, winningBid?: number) => void;
  setTrump: (suit: Suit) => void;
  setPartnerSpecs: (specs: PartnerCardSpec[]) => void;
  holdTrick: (trick: Trick) => void;
  addRevealedPartner: (playerId: string, all?: string[]) => void;
  setCurrentTrick: (trick: Trick) => void;
  finishTrick: (winnerId: string, completed: CompletedTrick[], nextTurn: string | null) => void;
  setCurrentTurn: (id: string | null) => void;
  setScore: (score: ScoreResult | null) => void;
  applyPublicState: (s: Partial<PublicGameState>) => void;
  pushBanner: (kind: Banner['kind'], text: string) => void;
  setError: (message: string | null) => void;
  setInvite: (invite: GameState['invite']) => void;
  setEndVote: (vote: EndVote | null) => void;
  stopGame: (reason: string, players?: Player[], config?: RoomConfig) => void;
  clearStoppedReason: () => void;
  setRejoining: (v: boolean) => void;
  dismissBanner: (id: number) => void;
  leaveRoom: () => void;
  resetRound: () => void;
  addChat: (msg: ChatMessage) => void;
  setChatHistory: (msgs: ChatMessage[]) => void;
  markChatRead: () => void;
  addEmote: (msg: PlayerEmoteMessage) => void;
  removeEmote: (id: string) => void;
}

const base = {
  roomCode: null,
  config: null,
  players: [] as Player[],
  connected: false,
  phase: 'waiting' as GamePhase,
  myHand: [] as Card[],
  handCounts: {} as Record<string, number>,
  declarerHand: [] as Card[],
  bids: [] as BidEntry[],
  currentBidder: null,
  highestBid: 120,
  declarerId: null,
  passedPlayers: [] as string[],
  trump: null,
  partnerSpecs: [] as PartnerCardSpec[],
  revealedPartners: [] as string[],
  currentTrick: EMPTY_TRICK,
  lastTrick: null,
  completedTricks: [] as CompletedTrick[],
  currentLeader: null,
  currentTurn: null,
  settling: false,
  trickWinnerId: null,
  lastTrickPoints: 0,
  score: null,
  teamPoints: null,
  roundWinner: null,
  invite: null as GameState['invite'],
  endVote: null as EndVote | null,
  stoppedReason: null as string | null,
  banners: [] as Banner[],
  error: null,
  errorNonce: 0,
  rejoining: false,
  chat: [] as ChatMessage[],
  unreadChat: false,
  emotes: [] as PlayerEmoteMessage[],
};

let bannerSeq = 0;

export const useGameStore = create<GameState & GameActions>((set) => ({
  myPlayerId: getPlayerId(),
  myPlayerName: getPlayerName(),
  myAvatar: getAvatar(),
  ...base,
  // A refresh mid-game should land back at the table, not at home.
  rejoining: !!lastRoom(),

  setIdentity: (myPlayerName, myAvatar) => set({ myPlayerName, myAvatar }),
  setConnected: (connected) => set({ connected }),

  setRoom: (roomCode, players, config) => {
    rememberRoom(roomCode);
    set({ roomCode, players, config, phase: 'waiting', rejoining: false });
  },

  setPlayers: (players) => set({ players }),
  setConfig: (config) => set({ config }),
  setPhase: (phase) => set({ phase }),

  setMyHand: (myHand) => set({ myHand }),
  removeFromMyHand: (cardId) => set((s) => ({ myHand: s.myHand.filter((c) => c.id !== cardId) })),
  setHandCounts: (handCounts) => set({ handCounts }),
  setDeclarerHand: (declarerHand) => set({ declarerHand }),

  addBid: (entry) => set((s) => ({
    bids: [...s.bids, entry],
    passedPlayers: entry.bid === 'pass' ? [...s.passedPlayers, entry.playerId] : s.passedPlayers,
  })),

  setBidding: (p) => set((s) => ({
    currentBidder: p.currentBidder !== undefined ? p.currentBidder : s.currentBidder,
    highestBid: p.highestBid ?? s.highestBid,
    bids: p.bids ?? s.bids,
  })),

  setDeclarer: (declarerId, winningBid) => set((s) => ({
    declarerId,
    highestBid: winningBid ?? s.highestBid,
    currentBidder: null,
    phase: 'trump_selection',
  })),

  setTrump: (trump) => set({ trump, phase: 'partner_selection' }),

  setPartnerSpecs: (partnerSpecs) => set({ partnerSpecs }),

  // The closing card of a trick arrives with the whole trick, which is
  // held on screen until the server sweeps it.
  holdTrick: (trick) => set({
    currentTrick: trick,
    settling: true,
    trickWinnerId: trick.winnerId,
  }),

  addRevealedPartner: (playerId, all) => set((s) => ({
    revealedPartners: all ?? (s.revealedPartners.includes(playerId)
      ? s.revealedPartners
      : [...s.revealedPartners, playerId]),
  })),

  setCurrentTrick: (currentTrick) => set({ currentTrick }),

  finishTrick: (_winnerId, completedTricks, nextTurn) => set({
    completedTricks,
    lastTrick: completedTricks[completedTricks.length - 1] ?? null,
    lastTrickPoints: completedTricks[completedTricks.length - 1]?.points ?? 0,
    currentTrick: EMPTY_TRICK,
    currentTurn: nextTurn,
    currentLeader: nextTurn,
    settling: false,
    trickWinnerId: null,
  }),

  setCurrentTurn: (currentTurn) => set({ currentTurn }),
  setScore: (score) => set({ score }),

  applyPublicState: (s) => set((prev) => ({
    phase: s.phase ?? prev.phase,
    players: s.players ?? prev.players,
    config: s.config ?? prev.config,
    bids: s.bids ?? prev.bids,
    currentBidder: s.currentBidder !== undefined ? s.currentBidder : prev.currentBidder,
    highestBid: s.highestBid ?? prev.highestBid,
    declarerId: s.declarerId !== undefined ? s.declarerId : prev.declarerId,
    passedPlayers: s.passedPlayers ?? prev.passedPlayers,
    trump: s.trump !== undefined ? s.trump : prev.trump,
    partnerSpecs: s.partnerSpecs ?? prev.partnerSpecs,
    revealedPartners: s.revealedPartners ?? prev.revealedPartners,
    currentTrick: s.currentTrick ?? prev.currentTrick,
    completedTricks: s.completedTricks ?? prev.completedTricks,
    currentLeader: s.currentLeader !== undefined ? s.currentLeader : prev.currentLeader,
    currentTurn: s.currentTurn !== undefined ? s.currentTurn : prev.currentTurn,
    handCounts: s.hands ?? prev.handCounts,
    teamPoints: s.teamPoints ?? prev.teamPoints,
    roundWinner: s.roundWinner ?? prev.roundWinner,
    myHand: s.myHand ?? prev.myHand,
  })),

  pushBanner: (kind, text) => set((s) => ({
    banners: [...s.banners.slice(-2), { id: ++bannerSeq, kind, text }],
  })),

  dismissBanner: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),

  setError: (error) => set((s) => ({ error, errorNonce: s.errorNonce + 1 })),

  setRejoining: (rejoining) => set({ rejoining }),

  setInvite: (invite) => set({ invite }),

  setEndVote: (endVote) => set({ endVote }),

  addChat: (msg) => set((s) => ({ chat: [...s.chat, msg], unreadChat: true })),
  setChatHistory: (chat) => set({ chat }),
  markChatRead: () => set({ unreadChat: false }),

  addEmote: (msg) => set((s) => ({ emotes: [...s.emotes, msg] })),
  removeEmote: (id) => set((s) => ({
    emotes: s.emotes.filter((e) => e.playerId + e.timestamp.toString() !== id)
  })),

  // The round is thrown away but the room, the seats and the code survive,
  // so the table can regroup in the lobby and deal again.
  stopGame: (reason, players, config) => set((s) => ({
    ...base,
    roomCode: s.roomCode,
    config: config ?? s.config,
    players: players ?? s.players,
    connected: s.connected,
    invite: s.invite,
    phase: 'waiting' as GamePhase,
    stoppedReason: reason,
  })),

  clearStoppedReason: () => set({ stoppedReason: null }),

  // Leaving a room clears the room, not the connection. The socket is
  // still up, and wiping `connected` here left the next lobby unable to
  // start because its button waits on it.
  leaveRoom: () => {
    forgetRoom();
    set((s) => ({ ...base, connected: s.connected }));
  },
  resetRound: () => set({
    ...base,
    roomCode: useGameStore.getState().roomCode,
    config: useGameStore.getState().config,
    players: useGameStore.getState().players,
    connected: useGameStore.getState().connected,
  }),
}));
