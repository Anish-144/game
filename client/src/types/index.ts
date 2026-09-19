// ============================================================
// Client Types — Kadi Teri v3
// ============================================================

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type GameMode = 'classic' | '500';
export type Occurrence = 'first' | 'second' | 'any';
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type MatchType = 'humans' | 'mixed' | 'bots';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  copy: 1 | 2;
}

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  isReady: boolean;
  isConnected: boolean;
  isBot: boolean;
  difficulty?: BotDifficulty;
  avatar: number;
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

export interface PartnerCardSpec {
  rank: Rank;
  suit: Suit;
  occurrence: Occurrence;
  usesOtherCopy: boolean;
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
  playerCount: number;
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

/** What the host assembles on the Create Room screen. */
export interface RoomSetup {
  mode: GameMode;
  playerCount: number;
  matchType: MatchType;
  botCount: number;
  botDifficulty: BotDifficulty;
}
