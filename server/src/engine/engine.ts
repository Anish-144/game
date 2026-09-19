// ============================================================
// Game Engine — Kadi Teri v2 (Authoritative State Machine)
// ============================================================

import { Card, GameState, PartnerCardSpec, Player, RoomConfig, ScoreResult, Suit } from '../types';
import { buildDeck, deal, requiredPartnerCount } from './deck';
import { applyBid, applyPass, initBidding, BidResult } from './bidding';
import { validatePartnerSpecs } from './partner';
import { applyPlay, PlayResult } from './trick';
import { computeScore } from './scoring';

export class GameEngine {
  public state: GameState;

  constructor(config: RoomConfig, players: Player[]) {
    const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
    this.state = {
      phase: 'waiting',
      config,
      players: sorted,
      hands: {},
      bids: [],
      currentBidder: null,
      highestBid: 120,
      declarerId: null,
      passedPlayers: new Set(),
      trump: null,
      partnerSpecs: [],
      revealedPartners: [],
      newlyRevealedPartner: null,
      firedSpecs: [],
      occurrenceCounts: {},
      otherOccurrenceCounts: {},
      currentTrick: { plays: [], leadSuit: null, winnerId: null },
      completedTricks: [],
      currentLeader: null,
      currentTurn: null,
      teamPoints: null,
      roundWinner: null,
    };
  }

  startGame(): void {
    const deck = buildDeck(this.state.config.mode, this.state.config.playerCount);
    const playerIds = this.state.players.map((p) => p.id);
    this.state.hands = deal(deck, playerIds);
    initBidding(this.state);
  }

  placeBid(playerId: string, bid: number): BidResult {
    const result = applyBid(this.state, playerId, bid);
    if (result.valid && result.biddingComplete) {
      this.state.phase = 'trump_selection';
      this.state.currentBidder = null;
    }
    return result;
  }

  passBid(playerId: string): BidResult {
    const result = applyPass(this.state, playerId);
    if (result.valid && result.biddingComplete) {
      this.state.phase = 'trump_selection';
      this.state.currentBidder = null;
    }
    return result;
  }

  selectTrump(playerId: string, trump: Suit): { valid: boolean; error?: string } {
    if (this.state.phase !== 'trump_selection') return { valid: false, error: 'Wrong phase' };
    if (playerId !== this.state.declarerId) return { valid: false, error: 'Only declarer selects trump' };
    this.state.trump = trump;
    this.state.phase = 'partner_selection';
    return { valid: true };
  }

  selectPartners(playerId: string, specs: PartnerCardSpec[]): { valid: boolean; error?: string } {
    const error = validatePartnerSpecs(this.state, playerId, specs);
    if (error) return { valid: false, error };

    this.state.partnerSpecs = specs;
    this.state.phase = 'playing';
    this.state.currentLeader = this.state.declarerId;
    this.state.currentTurn = this.state.declarerId;
    return { valid: true };
  }

  playCard(playerId: string, cardId: string): PlayResult {
    const result = applyPlay(this.state, playerId, cardId);
    if (result.valid && result.roundComplete) {
      const score = computeScore(this.state);
      this.state.phase = 'scoring';
      this.state.teamPoints = {
        declarerTeam: { playerIds: score.declarerTeam.playerIds, points: score.declarerTeam.points },
        opponentTeam: { playerIds: score.opponentTeam.playerIds, points: score.opponentTeam.points },
      };
      this.state.roundWinner = score.roundWinner;
    }
    return result;
  }

  getScore(): ScoreResult | null {
    if (this.state.phase !== 'scoring') return null;
    return computeScore(this.state);
  }

  /**
   * Public state. Hands stay private and become counts.
   * The partner cards themselves are public once the declarer names
   * them, so whoever holds one knows they are on the declaring side.
   * Who holds them is still hidden until the card is played.
   */
  publicState(): Omit<GameState, 'hands' | 'passedPlayers' | 'firedSpecs'> & {
    hands: Record<string, number>;
    passedPlayers: string[];
  } {
    const { hands, passedPlayers, firedSpecs, ...rest } = this.state;
    return {
      ...rest,
      hands: Object.fromEntries(Object.entries(hands).map(([id, h]) => [id, h.length])),
      passedPlayers: Array.from(passedPlayers),
    };
  }

  /** Private state for one player — includes their hand */
  privateState(playerId: string): ReturnType<GameEngine['publicState']> & { myHand: Card[] } {
    return {
      ...this.publicState(),
      myHand: this.state.hands[playerId] ?? [],
    };
  }

  /** Get the declarer's hand (for partner picker) — only sent to declarer */
  declarerHand(): Card[] {
    return this.state.hands[this.state.declarerId!] ?? [];
  }

  updateSocket(playerId: string, socketId: string): void {
    const p = this.state.players.find((x) => x.id === playerId);
    if (p) { p.socketId = socketId; p.isConnected = true; }
  }

  markDisconnected(playerId: string): void {
    const p = this.state.players.find((x) => x.id === playerId);
    if (p) p.isConnected = false;
  }

  markReady(playerId: string): void {
    const p = this.state.players.find((x) => x.id === playerId);
    if (p) p.isReady = !p.isReady;
  }

  allReady(): boolean {
    return (
      this.state.players.length === this.state.config.playerCount &&
      this.state.players.every((p) => p.isReady)
    );
  }
}
