// ============================================================
// The table: opponent seats arranged around a centre trick area
// ============================================================

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../../ui';
import PlayingCard from './PlayingCard';
import { SUIT_ACCENT, SUIT_GLYPH } from '../../lib/cards';
import type { Player, Suit, Trick } from '../../types';
import { useGameStore } from '../../store/gameStore';

export interface SeatView {
  player: Player;
  cardsLeft: number;
  isDeclarer: boolean;
  isPartner: boolean;
  isDoublePartner?: boolean;
  partnerCardCount?: number;
  partnerCards?: import('../../types').PartnerCardSpec[];
  isTurn: boolean;
  bid: number | 'pass' | null;
  /** Points on this seat: their own, or the team total once fully revealed. */
  points: number;
  /** What those points are counted against. */
  outOf: number;
  /** Seat is openly on the declaring side, so it counts toward the contract. */
  onDeclaringSide: boolean;
  /** Show the running score instead of the auction bid. */
  showPoints: boolean;
}

/**
 * Adaptive seat positioning around the stadium-shaped table.
 * Opponents are arranged clockwise from the local player's left (bottom-left -> left -> top -> right -> bottom-right).
 */
function getSeatPosition(index: number, count: number): { x: number; y: number; angle: number } {
  if (count <= 0) return { x: 0, y: -36, angle: 270 };
  if (count === 1) return { x: 0, y: -36, angle: 270 };

  // For 6 or more opponents, place 2 on left and 2 on right to maximize vertical space.
  // The rest spread comfortably across the wide top edge.
  const nSide = count >= 6 ? 2 : 1;
  const nTop = Math.max(1, count - 2 * nSide);

  let x = 0;
  let y = 0;

  if (index < nSide) {
    // Left edge (clockwise from bottom to top)
    if (nSide === 1) {
      x = -38;
      y = -4;
    } else {
      const t = index / (nSide - 1); // 0 (lower) to 1 (upper)
      x = -37 - Math.sin(t * Math.PI) * 2;
      y = 15 - t * 29; // +15% down to -14%
    }
  } else if (index < nSide + nTop) {
    // Top edge (clockwise from left to right)
    const topIdx = index - nSide;
    const t = nTop === 1 ? 0.5 : topIdx / (nTop - 1);
    const span = nTop >= 5 ? 28 : nTop >= 3 ? 23 : 16;
    x = -span + t * (2 * span);
    // Subtle arch curving down towards the table ends
    const arch = 1 - Math.pow(x / 32, 2) * 0.08;
    y = -35.5 * arch;
  } else {
    // Right edge (clockwise from top to bottom)
    const rightIdx = index - nSide - nTop;
    if (nSide === 1) {
      x = 38;
      y = -4;
    } else {
      const t = rightIdx / (nSide - 1); // 0 (upper) to 1 (lower)
      x = 37 + Math.sin(t * Math.PI) * 2;
      y = -14 + t * 29; // -14% down to +15%
    }
  }

  let angle = Math.atan2(y, x) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  return { x, y, angle };
}

function polar(angleDeg: number, rx: number, ry: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: rx * Math.cos(a), y: ry * Math.sin(a) };
}

export default function Table({
  seats,
  total,
  trick,
  trump,
  playerById,
}: {
  seats: SeatView[];
  total: number;
  trick: Trick;
  trump: Suit | null;
  playerById: (id: string) => Player | undefined;
}) {
  const crowded = total > 7;
  const bubble = crowded ? 78 : 92;       // width of one seat block
  const avatar = crowded ? 42 : 52;

  /** Where each player sits, so a played card can fly toward them. */
  const angleByPlayer = useMemo(() => {
    const m = new Map<string, number>();
    seats.forEach((s, i) => {
      const pos = getSeatPosition(i, seats.length);
      m.set(s.player.id, pos.angle);
    });
    return m;
  }, [seats]);

  return (
    <div className="relative flex-1 min-h-0 bg-felt overflow-hidden">
      {/* felt ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          left: '9%', right: '9%', top: '13%', bottom: '15%',
          border: '2px solid rgba(255,255,255,.07)',
          boxShadow: 'inset 0 0 70px rgba(0,0,0,.4)',
        }}
      />

      {/* opponents — positioned with offsets rather than a transform, so
          framer-motion layout animations cannot fight the centring */}
      {seats.map((seat, i) => {
        const { x, y } = getSeatPosition(i, seats.length);
        return (
          <div
            key={seat.player.id}
            className="absolute flex flex-col items-center"
            style={{
              left: `calc(${50 + x}% - ${bubble / 2}px)`,
              top: `calc(${50 + y}% - ${avatar / 2 + 6}px)`,
              width: bubble,
            }}
          >
            <Seat seat={seat} avatarSize={avatar} />
          </div>
        );
      })}

      {/* centre trick */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <TrickCircle
          trick={trick}
          trump={trump}
          playerById={playerById}
          angleByPlayer={angleByPlayer}
          compact={crowded}
        />
      </div>
    </div>
  );
}

function Seat({ seat, avatarSize }: { seat: SeatView; avatarSize: number }) {
  const {
    player, cardsLeft, isDeclarer, isPartner, isDoublePartner, isTurn, bid,
    points, outOf, onDeclaringSide, showPoints,
  } = seat;

  // Select the array itself, never a fresh one. A selector that returns a new
  // array on every call makes useSyncExternalStore re-render without end, which
  // React aborts with "Maximum update depth exceeded" and takes the tree down.
  const allEmotes = useGameStore((s) => s.emotes);
  const emotes = useMemo(
    () => allEmotes.filter((e) => e.playerId === player.id),
    [allEmotes, player.id],
  );

  return (
    <>
      <div className="relative">
        {/* Emotes float above the avatar */}
        <AnimatePresence>
          {emotes.map((e) => (
            <motion.div
              key={e.playerId + e.timestamp}
              initial={{ opacity: 0, y: 10, scale: 0.5 }}
              animate={{ opacity: 1, y: -40, scale: 1.5 }}
              exit={{ opacity: 0, y: -60, scale: 1 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-full z-50 pointer-events-none text-2xl drop-shadow-md"
            >
              {e.emote}
            </motion.div>
          ))}
        </AnimatePresence>

        <div
          className={`rounded-full p-[3px] ${isTurn ? 'ring-turn' : ''}`}
          style={{
            background: isTurn
              ? 'linear-gradient(180deg,#fcd34d,#d97706)'
              : isDeclarer
                ? 'rgba(245,158,11,.5)'
                : isPartner
                  ? (isDoublePartner ? 'rgba(251,191,36,.65)' : 'rgba(52,211,153,.55)')
                  : 'rgba(255,255,255,.14)',
          }}
        >
          <Avatar
            name={player.name}
            index={player.avatar}
            isBot={player.isBot}
            size={avatarSize}
            dimmed={!player.isConnected}
          />
        </div>

        {isDeclarer && (
          <span
            className="absolute -top-1 -left-1 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px]"
            style={{ background: '#f59e0b', boxShadow: '0 2px 8px rgba(0,0,0,.45)' }}
            title="Declarer"
          >
            👑
          </span>
        )}
        {isPartner && (
          <div className="absolute -top-2 -right-4 flex items-center gap-0.5 z-10">
            {seat.partnerCards?.map((c, idx) => (
              <span
                key={idx}
                className="flex items-center justify-center min-w-[24px] h-[24px] px-1 rounded-full text-[11px] font-black bg-white"
                style={{
                  color: SUIT_ACCENT[c.suit],
                  boxShadow: '0 2px 8px rgba(0,0,0,.45)',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}
                title={`Partner Card: ${c.rank} of ${c.suit}`}
              >
                {c.rank}<span className="text-[12.5px] ml-[1px] leading-none" style={{ marginTop: '-1px' }}>{SUIT_GLYPH[c.suit]}</span>
              </span>
            ))}
            {(!seat.partnerCards || seat.partnerCards.length === 0) && (
              <span
                className="min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{
                  background: isDoublePartner ? '#fbbf24' : '#34d399',
                  color: '#04251b',
                  boxShadow: '0 2px 8px rgba(0,0,0,.45)',
                }}
                title={isDoublePartner ? 'Double partner (holds both partner cards)' : 'Revealed partner'}
              >
                {isDoublePartner ? '★★' : '★'}
              </span>
            )}
          </div>
        )}

        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 h-5 rounded-full text-[11.5px] font-black tabular flex items-center"
          style={{ background: 'rgba(11,17,24,.92)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,.16)' }}
        >
          {cardsLeft}
        </span>
      </div>

      <div
        className="mt-1.5 text-[12px] font-bold text-center leading-tight w-full max-w-[88px] truncate text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        title={player.name}
      >
        {player.name}
        {player.takenOver && <span className="text-white/45 font-semibold"> (bot)</span>}
      </div>

      {showPoints ? (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-black tabular whitespace-nowrap shadow-md border border-white/10"
          style={onDeclaringSide
            ? { background: 'rgba(245,158,11,.3)', color: '#fcd34d' }
            : { background: 'rgba(16,185,129,.25)', color: '#6ee7b7' }}
          title={onDeclaringSide ? 'Points against the contract' : 'Points out of what the declaring side has not taken'}
        >
          {points}
          <span className="opacity-60"> / {outOf}</span>
        </div>
      ) : bid !== null ? (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold tabular shadow-md border border-white/10"
          style={bid === 'pass'
            ? { background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.65)' }
            : { background: 'rgba(245,158,11,.28)', color: '#fcd34d' }}
        >
          {bid === 'pass' ? 'pass' : bid}
        </div>
      ) : null}
    </>
  );
}

function TrickCircle({
  trick,
  trump,
  playerById,
  angleByPlayer,
  compact,
}: {
  trick: Trick;
  trump: Suit | null;
  playerById: (id: string) => Player | undefined;
  angleByPlayer: Map<string, number>;
  compact: boolean;
}) {
  const size = compact ? 154 : 188;
  const cardW = compact ? 38 : 48;
  const radius = compact ? 40 : 50;
  const settled = !!trick.winnerId;

  return (
    <div
      className="relative rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 50% 42%, rgba(255,255,255,.08), rgba(0,0,0,.28))',
        border: '1.5px solid rgba(255,255,255,.12)',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,.45)',
      }}
    >
      {trick.plays.length === 0 && (
        <div className="text-center px-5">
          <div className="text-[13px] text-white/40 font-semibold leading-snug">
            {trump ? 'Waiting for the lead' : 'Trump not set'}
          </div>
          {trump && (
            <div className="text-[30px] mt-1" style={{ color: SUIT_ACCENT[trump] }}>
              {SUIT_GLYPH[trump]}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {trick.plays.map((p, i) => {
          // 90 degrees is the local player's own seat at the bottom.
          const angle = angleByPlayer.get(p.playerId) ?? 90;
          const { x, y } = polar(angle, radius, radius);
          const player = playerById(p.playerId);
          return (
            <motion.div
              key={p.card.id}
              initial={{ scale: 0.6, opacity: 0, x: x * 2.4, y: y * 2.4 }}
              animate={{ scale: 1, opacity: 1, x, y, rotate: (i % 3) * 5 - 5 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="absolute"
            >
              <PlayingCard
                rank={p.card.rank}
                suit={p.card.suit}
                width={cardW}
                points="above"
                winner={settled && trick.winnerId === p.playerId}
                dimmed={settled && trick.winnerId !== p.playerId}
              />
              {player && (
                <div
                  className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 px-1.5 h-[14px] rounded-full text-[9.5px] font-bold whitespace-nowrap flex items-center shadow-md border border-white/10"
                  style={{
                    background: 'rgba(11,17,24,.95)',
                    color: settled && trick.winnerId === p.playerId ? '#fcd34d' : '#e2e8f0',
                  }}
                >
                  {player.name.slice(0, 8)}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
