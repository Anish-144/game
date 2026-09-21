// ============================================================
// Shared Types — Kadi Teri v3 (Classic + 500 Edition)
// ============================================================

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type GameMode = 'classic' | '500';
export type Occurrence = 'first' | 'second' | 'any';
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type MatchType = 'humans' | 'mixed' | 'bots';

/**
 * Card — in 500 mode two copies exist with id suffixes _1 and _2.
 * Classic: id = "A_spades" (no suffix)
 * 500:     id = "A_spades_1" | "A_spades_2"
 */
export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  copy: 1 | 2;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  seatIndex: number;
  isReady: boolean;
  isConnected: boolean;
  isBot: boolean;
  difficulty?: BotDifficulty;
  avatar: number; // 0-11, picks an accent colour + glyph on the client
  /** A human seat a bot is playing because the person left mid-round. */
  takenOver?: boolean;
}

export interface EndVote {
  startedBy: string;
  startedAt: number;
  /** playerId -> agreed to end */
  votes: Record<string, boolean>;
  /** How many yes votes end it, fixed when the vote opens. */
  needed: number;
  eligible: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface PlayerEmoteMessage {
  playerId: string;
  emote: string;
  timestamp: number;
}


export type GamePhase =
  | 'waiting'
  | 'bidding'
  | 'trump_selection'
  | 'partner_selection'
  | 'playing'
  | 'scoring';

export interface BidEntry {
  playerId: string;
  bid: number | 'pass';
  timestamp: number;
}

/**
 * A partner card specification stored on the server.
 * usesOtherCopy = true → don't count the declarer's own copy (State B)
 */
export interface PartnerCardSpec {
  rank: Rank;
  suit: Suit;
  occurrence: Occurrence;     // 'any' = classic (1 deck), else 'first'|'second'
  usesOtherCopy: boolean;     // true in State B (declarer holds 1 copy)
}

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export interface Trick {
  plays: TrickPlay[];
  leadSuit: Suit | null;
  winnerId: string | null;
}

export interface CompletedTrick {
  winnerId: string;
  cards: Card[];
  pointCards: Card[];
  plays: TrickPlay[];
  leadSuit: Suit | null;
  points: number;
}

export interface RoomConfig {
  playerCount: number; // 4–10
  playerCountMin: number;
  playerCountMax: number;
  hostId: string;
  roomCode: string;
  mode: GameMode;
  matchType: MatchType;
  botDifficulty: BotDifficulty;
}

export interface TeamPoints {
  declarerTeam: { playerIds: string[]; points: number };
  opponentTeam: { playerIds: string[]; points: number };
}

export interface PointBreakdownItem {
  rank: Rank;
  suit: Suit;
  points: number;
  count: number;
  total: number;
  winnerId: string;
  winnerName?: string;
}

export interface ScoreResult {
  declarerTeam: { playerIds: string[]; points: number; won: boolean };
  opponentTeam: { playerIds: string[]; points: number; won: boolean };
  bid: number;
  roundWinner: 'declarer' | 'opponent';
  pointBreakdown: PointBreakdownItem[];
  partnerCardsSelected: PartnerCardSpec[];
  revealedPartners: string[];
  declarerId: string;
  trump: Suit;
}

export interface GameState {
  phase: GamePhase;
  turnStartedAt: number;
  config: RoomConfig;
  players: Player[];

  // Server-private: hands keyed by playerId
  hands: Record<string, Card[]>;

  // Bidding
  bids: BidEntry[];
  currentBidder: string | null;
  highestBid: number;
  declarerId: string | null;
  passedPlayers: Set<string>;

  // Trump & Partner (server-authoritative)
  trump: Suit | null;
  partnerSpecs: PartnerCardSpec[];   // never sent to non-declarer clients
  revealedPartners: string[];        // playerIds whose partnership is public
  newlyRevealedPartner: string | null;
  firedSpecs: number[];              // indexes of partner specs already claimed

  // Occurrence tracking
  occurrenceCounts: Record<string, number>; // key = `${rank}_${suit}`
  // For State B: track plays excluding declarer's copies
  otherOccurrenceCounts: Record<string, number>;

  // Playing
  currentTrick: Trick;
  completedTricks: CompletedTrick[];
  currentLeader: string | null;
  currentTurn: string | null;

  // Scoring
  teamPoints: TeamPoints | null;
  roundWinner: 'declarer' | 'opponent' | null;
}

// ─── Socket Payloads ──────────────────────────────────────────────────────────

export interface CreateRoomPayload {
  playerId: string;
  playerName: string;
  playerCount: number;
  mode: GameMode;
  matchType: MatchType;
  botCount: number;
  botDifficulty: BotDifficulty;
  avatar?: number;
}

export interface JoinRoomPayload {
  playerId: string;
  playerName: string;
  roomCode: string;
  avatar?: number;
}

export interface AddBotPayload {
  playerId: string;
  roomCode: string;
  difficulty?: BotDifficulty;
}

export interface RemoveBotPayload {
  playerId: string;
  roomCode: string;
  botId: string;
}

export interface StartGamePayload {
  playerId: string;
  roomCode: string;
}

export interface ShareInvitePayload {
  roomCode: string;
  origin?: string;
}

export interface PlayerReadyPayload {
  playerId: string;
  roomCode: string;
}

export interface PlaceBidPayload {
  playerId: string;
  roomCode: string;
  bid: number;
}

export interface PassBidPayload {
  playerId: string;
  roomCode: string;
}

export interface SelectTrumpPayload {
  playerId: string;
  roomCode: string;
  trump: Suit;
}

export interface SelectPartnersPayload {
  playerId: string;
  roomCode: string;
  partnerSpecs: PartnerCardSpec[];
}

export interface PlayCardPayload {
  playerId: string;
  roomCode: string;
  cardId: string;
}

export interface ReconnectPayload {
  playerId: string;
  roomCode: string;
}

export interface ProposeEndPayload {
  playerId: string;
  roomCode: string;
}

export interface CastEndVotePayload {
  playerId: string;
  roomCode: string;
  agree: boolean;
}

export interface SendChatPayload {
  playerId: string;
  roomCode: string;
  text: string;
}

export interface SendEmotePayload {
  playerId: string;
  roomCode: string;
  emote: string;
}

export interface UpdateCapacityPayload {
  playerId: string;
  roomCode: string;
  newCapacity: number;
}

export interface PublicGameState {
  phase: GamePhase;
  config: RoomConfig;
  players: Player[];
  hands: Record<string, number>;
  bids: BidEntry[];
  currentBidder: string | null;
  highestBid: number;
  declarerId: string | null;
  passedPlayers: string[];
  trump: Suit | null;
  partnerSpecs: PartnerCardSpec[];
  revealedPartners: string[];
  newlyRevealedPartner: string | null;
  currentTrick: Trick;
  completedTricks: CompletedTrick[];
  currentLeader: string | null;
  currentTurn: string | null;
  teamPoints: TeamPoints | null;
  roundWinner: 'declarer' | 'opponent' | null;
  myHand?: Card[];
}

export interface RoomSetup {
  mode: GameMode;
  playerCount: number;
  matchType: MatchType;
  botCount: number;
  botDifficulty: BotDifficulty;
}
