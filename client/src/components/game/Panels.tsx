// ============================================================
// Phase panels — auction, trump, partner selection
// Each one docks to the bottom so the table stays visible.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Spinner } from '../../ui';
import PlayingCard from './PlayingCard';
import {
  BID_STEP, MIN_BID, RANKS, SUITS, SUIT_ACCENT, SUIT_GLYPH, SUIT_LABEL, maxBidFor,
} from '../../lib/cards';
import type { BidEntry, Card, GameMode, PartnerCardSpec, Rank, Suit } from '../../types';
import { buzz } from '../../lib/haptics';
import { play } from '../../lib/audio';

// ─── shell ────────────────────────────────────────────────────────────────────

export function Dock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="shrink-0 rounded-t-[28px] px-5 pt-4"
      style={{
        background: 'linear-gradient(180deg,#132a22 0%,#0a1712 100%)',
        borderTop: '1px solid rgba(255,255,255,.14)',
        boxShadow: '0 -14px 40px rgba(0,0,0,.45)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
      }}
    >
      <div className="text-center mb-3">
        <h2 className="text-[19px] font-extrabold">{title}</h2>
        {subtitle && <p className="text-[13.5px] text-white/55 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

export function WaitingDock({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Dock title={title} subtitle={subtitle}>
      <div className="flex justify-center py-3">
        <Spinner size={28} />
      </div>
    </Dock>
  );
}

// ─── auction ──────────────────────────────────────────────────────────────────

export function BidPanel({
  mode,
  highestBid,
  myTurn,
  bidderName,
  bids,
  nameOf,
  onBid,
  onPass,
}: {
  mode: GameMode;
  highestBid: number;
  myTurn: boolean;
  bidderName: string;
  bids: BidEntry[];
  nameOf: (id: string) => string;
  onBid: (bid: number) => void;
  onPass: () => void;
}) {
  const cap = maxBidFor(mode);
  const floor = Math.max(MIN_BID, highestBid + BID_STEP);
  const taken = useMemo(
    () => new Set(bids.filter((b) => b.bid !== 'pass').map((b) => b.bid as number)),
    [bids],
  );

  const nextFree = (from: number, dir: 1 | -1): number => {
    let v = from;
    while (v >= floor && v <= cap && taken.has(v)) v += dir * BID_STEP;
    return Math.max(floor, Math.min(cap, v));
  };

  const [value, setValue] = useState(() => nextFree(floor, 1));

  useEffect(() => { setValue(nextFree(floor, 1)); /* eslint-disable-next-line */ }, [floor, highestBid]);

  const canBid = myTurn && value >= floor && value <= cap && !taken.has(value);

  if (!myTurn) {
    return (
      <Dock title="Auction" subtitle={`${bidderName} is deciding`}>
        <BidHistory bids={bids} nameOf={nameOf} />
        <div className="flex items-center justify-center gap-3 py-2">
          <Spinner size={22} />
          <span className="text-[15px] text-white/60 font-semibold">
            Highest bid <span className="text-gold-300 font-black tabular">{Math.max(highestBid, 0)}</span>
          </span>
        </div>
      </Dock>
    );
  }

  return (
    <Dock title="Your bid" subtitle={`Minimum ${floor} · maximum ${cap}`}>
      <BidHistory bids={bids} nameOf={nameOf} />

      <div className="flex items-center gap-3 my-3">
        <StepButton
          label="−"
          disabled={value <= floor}
          onClick={() => setValue((v) => nextFree(Math.max(floor, v - BID_STEP), -1))}
        />
        <div className="flex-1 text-center">
          <div className="text-[44px] font-black leading-none tabular text-gold-gradient">{value}</div>
          <div className="text-[12.5px] text-white/45 mt-1">
            {taken.has(value) ? 'already bid' : 'points to win'}
          </div>
        </div>
        <StepButton
          label="+"
          disabled={value >= cap}
          onClick={() => setValue((v) => nextFree(Math.min(cap, v + BID_STEP), 1))}
        />
      </div>

      <div className="flex gap-2 justify-center mb-4">
        {[10, 25, 50].map((jump) => (
          <button
            key={jump}
            disabled={floor + jump > cap}
            onClick={() => { play('tap'); buzz('light'); setValue(nextFree(Math.min(cap, floor + jump), 1)); }}
            className="h-9 px-3.5 rounded-full text-[13.5px] font-bold surface disabled:opacity-35"
          >
            +{jump}
          </button>
        ))}
        <button
          onClick={() => { play('tap'); buzz('light'); setValue(nextFree(cap, -1)); }}
          className="h-9 px-3.5 rounded-full text-[13.5px] font-bold surface-gold text-gold-200"
        >
          Max {cap}
        </button>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" size="md" onClick={onPass} full>
          Pass
        </Button>
        <Button variant="gold" size="md" onClick={() => onBid(value)} disabled={!canBid} full>
          Bid {value}
        </Button>
      </div>
    </Dock>
  );
}

function StepButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => { if (disabled) return; play('tap'); buzz('light'); onClick(); }}
      disabled={disabled}
      className="w-[60px] h-[60px] rounded-full text-[28px] font-black surface flex items-center justify-center disabled:opacity-30 active:scale-92 transition-transform"
    >
      {label}
    </button>
  );
}

function BidHistory({ bids, nameOf }: { bids: BidEntry[]; nameOf: (id: string) => string }) {
  if (!bids.length) return null;
  const recent = bids.slice(-8);
  return (
    <div className="flex gap-2 overflow-x-auto no-bar pb-1 -mx-1 px-1" style={{ touchAction: 'pan-x' }}>
      {recent.map((b, i) => (
        <span
          key={`${b.playerId}-${b.timestamp}-${i}`}
          className="shrink-0 px-2.5 h-8 rounded-full text-[12.5px] font-bold flex items-center gap-1.5"
          style={b.bid === 'pass'
            ? { background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.5)' }
            : { background: 'rgba(245,158,11,.18)', color: '#fcd34d' }}
        >
          <span className="opacity-75">{nameOf(b.playerId).slice(0, 8)}</span>
          <span className="tabular">{b.bid === 'pass' ? 'pass' : b.bid}</span>
        </span>
      ))}
    </div>
  );
}

// ─── trump ────────────────────────────────────────────────────────────────────

export function TrumpPanel({
  hand,
  onSelect,
}: {
  hand: Card[];
  onSelect: (suit: Suit) => void;
}) {
  const counts = useMemo(() => {
    const m: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
    hand.forEach((c) => { m[c.suit] += 1; });
    return m;
  }, [hand]);

  return (
    <Dock title="Choose trump" subtitle="Trump beats every other suit">
      <div className="grid grid-cols-2 gap-3">
        {SUITS.map((suit) => (
          <motion.button
            key={suit}
            whileTap={{ scale: 0.95 }}
            onClick={() => { play('trump'); buzz('medium'); onSelect(suit); }}
            className="h-[104px] rounded-3xl flex flex-col items-center justify-center gap-1"
            style={{
              background: 'rgba(255,255,255,.07)',
              border: '1.5px solid rgba(255,255,255,.14)',
            }}
          >
            <span className="text-[40px] leading-none" style={{ color: SUIT_ACCENT[suit] }}>
              {SUIT_GLYPH[suit]}
            </span>
            <span className="text-[14px] font-bold">{SUIT_LABEL[suit]}</span>
            <span className="text-[12px] text-white/45 tabular">{counts[suit]} in hand</span>
          </motion.button>
        ))}
      </div>
    </Dock>
  );
}

// ─── partners ─────────────────────────────────────────────────────────────────

export function PartnerPanel({
  mode,
  required,
  trump,
  declarerHand,
  onConfirm,
}: {
  mode: GameMode;
  required: number;
  trump: Suit | null;
  declarerHand: Card[];
  onConfirm: (specs: PartnerCardSpec[]) => void;
}) {
  const copiesPerCard = mode === 'classic' ? 1 : 2;
  const [specs, setSpecs] = useState<PartnerCardSpec[]>([]);
  const [suit, setSuit] = useState<Suit>(trump ?? 'spades');

  const heldCount = (rank: Rank, s: Suit) =>
    declarerHand.filter((c) => c.rank === rank && c.suit === s).length;

  const chosenKey = (sp: PartnerCardSpec) => `${sp.rank}_${sp.suit}_${sp.occurrence}`;
  const chosen = new Set(specs.map(chosenKey));

  const toggle = (rank: Rank) => {
    const held = heldCount(rank, suit);
    if (held >= copiesPerCard) { buzz('warning'); return; }

    const usesOtherCopy = mode === '500' && held === 1;
    const occurrence = mode === 'classic' ? 'any' : 'first';
    const spec: PartnerCardSpec = { rank, suit, occurrence, usesOtherCopy };
    const key = chosenKey(spec);

    if (chosen.has(key)) {
      play('tap');
      setSpecs((list) => list.filter((s) => chosenKey(s) !== key));
      return;
    }
    if (specs.length >= required) { buzz('warning'); return; }
    play('tap');
    buzz('light');
    setSpecs((list) => [...list, spec]);
  };

  const setOccurrence = (index: number, occurrence: 'first' | 'second') => {
    play('tap');
    setSpecs((list) => list.map((s, i) => (i === index ? { ...s, occurrence } : s)));
  };

  const ready = specs.length === required;

  return (
    <Dock
      title={`Pick ${required} partner card${required > 1 ? 's' : ''}`}
      subtitle="The table is told which cards, but not who holds them"
    >
      {/* chosen slots */}
      <div className="flex gap-2.5 justify-center mb-4 flex-wrap">
        {Array.from({ length: required }, (_, i) => {
          const spec = specs[i];
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              {spec ? (
                <button onClick={() => setSpecs((l) => l.filter((_, j) => j !== i))}>
                  <PlayingCard rank={spec.rank} suit={spec.suit} width={52} selected />
                </button>
              ) : (
                <div
                  className="rounded-[10px] flex items-center justify-center text-[22px] text-white/25"
                  style={{ width: 52, height: 74, border: '1.5px dashed rgba(255,255,255,.28)' }}
                >
                  ?
                </div>
              )}
              {spec && mode === '500' && (
                <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.18)' }}>
                  {(['first', 'second'] as const).map((o) => (
                    <button
                      key={o}
                      disabled={spec.usesOtherCopy}
                      onClick={() => setOccurrence(i, o)}
                      className="px-2 h-7 text-[11.5px] font-bold disabled:opacity-40"
                      style={spec.occurrence === o
                        ? { background: '#fbbf24', color: '#241503' }
                        : { color: 'rgba(255,255,255,.6)' }}
                    >
                      {o === 'first' ? '1st' : '2nd'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* suit picker */}
      <div className="flex gap-2 mb-3">
        {SUITS.map((s) => (
          <button
            key={s}
            onClick={() => { play('tap'); setSuit(s); }}
            className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-1.5 text-[15px] font-bold"
            style={suit === s
              ? { background: 'rgba(255,255,255,.16)', border: '1.5px solid rgba(251,191,36,.7)' }
              : { background: 'rgba(255,255,255,.06)', border: '1.5px solid rgba(255,255,255,.1)' }}
          >
            <span className="text-[21px]" style={{ color: SUIT_ACCENT[s] }}>{SUIT_GLYPH[s]}</span>
            {s === trump && <span className="text-[10.5px] text-gold-300 font-black">TRUMP</span>}
          </button>
        ))}
      </div>

      {/* rank picker */}
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {RANKS.map((rank) => {
          const held = heldCount(rank, suit);
          const blocked = held >= copiesPerCard;
          const stateB = mode === '500' && held === 1;
          const isChosen = specs.some((s) => s.rank === rank && s.suit === suit);
          return (
            <button
              key={rank}
              disabled={blocked}
              onClick={() => toggle(rank)}
              className="h-[46px] rounded-xl text-[15px] font-black relative"
              style={
                blocked
                  ? { background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.2)' }
                  : isChosen
                    ? { background: 'linear-gradient(180deg,#fbbf24,#d97706)', color: '#241503' }
                    : { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' }
              }
            >
              {rank}
              {stateB && !isChosen && (
                <span className="absolute top-0.5 right-1 text-[9px] font-bold text-royal-400">B</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[12.5px] text-white/45 text-center mb-3 leading-snug">
        Greyed ranks are cards you already hold.
        {mode === '500' && ' A "B" card means you hold one copy, so the other copy counts.'}
      </p>

      <Button onClick={() => onConfirm(specs)} disabled={!ready}>
        {ready ? 'Confirm partners' : `Pick ${required - specs.length} more`}
      </Button>
    </Dock>
  );
}
