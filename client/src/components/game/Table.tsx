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
 * Seat angles run clockwise from the bottom of the ellipse, where the
 * local player always sits. Opponent 0 is the seat to their left.
 */
function seatAngle(index: number, total: number): number {
  return 90 + ((index + 1) * 360) / total;
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
  const bubble = crowded ? 74 : 90;       // width of one seat block
  const avatar = crowded ? 42 : 52;

  /** Where each player sits, so a played card can fly toward them. */
  const angleByPlayer = useMemo(() => {
    const m = new Map<string, number>();
    seats.forEach((s, i) => m.set(s.player.id, seatAngle(i, total)));
    return m;
  }, [seats, total]);

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
        const { x, y } = polar(seatAngle(i, total), 38, 35);
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
    player, cardsLeft, isDeclarer, isPartner, isTurn, bid,
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
                  ? 'rgba(52,211,153,.55)'
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
          <span
            className="absolute -top-1 -right-1 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] font-black"
            style={{ background: '#34d399', color: '#04251b', boxShadow: '0 2px 8px rgba(0,0,0,.45)' }}
            title="Revealed partner"
          >
            ★
          </span>
        )}

        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 h-5 rounded-full text-[11.5px] font-black tabular flex items-center"
          style={{ background: 'rgba(11,17,24,.92)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,.16)' }}
        >
          {cardsLeft}
        </span>
      </div>

      <div className="mt-2 text-[12.5px] font-bold text-center leading-tight w-full truncate">
        {player.name}
        {player.takenOver && <span className="text-white/45 font-semibold"> (bot)</span>}
      </div>

      {showPoints ? (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full text-[11.5px] font-black tabular whitespace-nowrap"
          style={onDeclaringSide
            ? { background: 'rgba(245,158,11,.24)', color: '#fcd34d' }
            : { background: 'rgba(16,185,129,.2)', color: '#6ee7b7' }}
          title={onDeclaringSide ? 'Points against the contract' : 'Points out of what the declaring side has not taken'}
        >
          {points}
          <span className="opacity-55"> / {outOf}</span>
        </div>
      ) : bid !== null ? (
        <div
          className="mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tabular"
          style={bid === 'pass'
            ? { background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.55)' }
            : { background: 'rgba(245,158,11,.22)', color: '#fcd34d' }}
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
  const size = compact ? 186 : 206;
  const cardW = compact ? 46 : 52;
  const radius = compact ? 50 : 58;
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
                  className="absolute -bottom-[15px] left-1/2 -translate-x-1/2 px-1.5 h-[15px] rounded-full text-[10px] font-bold whitespace-nowrap flex items-center"
                  style={{
                    background: 'rgba(11,17,24,.92)',
                    color: settled && trick.winnerId === p.playerId ? '#fcd34d' : '#cbd5e1',
                  }}
                >
                  {player.name.slice(0, 7)}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
