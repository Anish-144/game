// ============================================================
// Playing card face — readable at arm's length
// ============================================================

import { SUIT_GLYPH, SUIT_INK, cardPoints } from '../../lib/cards';
import type { Rank, Suit } from '../../types';

export interface CardFaceProps {
  rank: Rank;
  suit: Suit;
  width?: number;
  dimmed?: boolean;
  selected?: boolean;
  /** Where the point value goes: over the card, in the corner, or nowhere. */
  points?: 'above' | 'corner' | 'none';
  /** Align an above-card chip with the exposed left edge in a fan. */
  pointsAlign?: 'left' | 'center';
  /** Extra lift for the chip, so chips on neighbouring cards stagger. */
  pointsLift?: number;
  /** This card is one the declarer named, so mark it. */
  partner?: boolean;
  /** This card took the trick. */
  winner?: boolean;
  /** Text badge to display on the card (e.g. "1 Held"). */
  badge?: string;
}

export default function PlayingCard({
  rank,
  suit,
  width = 62,
  dimmed = false,
  selected = false,
  points = 'corner',
  pointsAlign = 'center',
  pointsLift = 0,
  partner = false,
  winner = false,
  badge,
}: CardFaceProps) {
  const height = Math.round(width * 1.42);
  const ink = SUIT_INK[suit];
  const glyph = SUIT_GLYPH[suit];
  const value = cardPoints({ rank, suit });
  const isTen = rank === '10';
  // "10" is two glyphs wide, so it is set smaller and tighter to stay
  // inside the narrow strip each card shows in a fan.
  const rankSize = Math.round(width * (isTen ? 0.33 : 0.44));
  const rankStyle = { fontSize: rankSize, color: ink, letterSpacing: isTen ? '-0.05em' : undefined };

  const ring = winner
    ? '0 0 0 3px #fcd34d, 0 14px 28px rgba(0,0,0,.55)'
    : selected
      ? '0 16px 30px rgba(0,0,0,.5), 0 0 0 2.5px #fcd34d'
      : partner
        ? '0 0 0 2.5px #34d399, 0 5px 14px rgba(0,0,0,.45)'
        : '0 4px 12px rgba(0,0,0,.45)';

  return (
    <div className="relative" style={{ width, height }}>
      {/* point value above the card */}
      {points === 'above' && value > 0 && (
        <div
          className="absolute rounded-full font-black flex items-center justify-center whitespace-nowrap"
          style={{
            top: -Math.round(width * 0.28) - pointsLift,
            left: pointsAlign === 'left' ? 0 : '50%',
            transform: pointsAlign === 'left' ? 'none' : 'translateX(-50%)',
            minWidth: Math.round(width * 0.34),
            height: Math.round(width * 0.25),
            padding: `0 ${Math.round(width * 0.05)}px`,
            fontSize: Math.round(width * 0.18),
            background: value === 30
              ? 'linear-gradient(180deg,#fcd34d,#d97706)'
              : 'linear-gradient(180deg,#6ee7b7,#059669)',
            color: value === 30 ? '#2a1803' : '#04251b',
            boxShadow: '0 2px 6px rgba(0,0,0,.45)',
            opacity: dimmed ? 0.4 : 1,
          }}
        >
          {value}
        </div>
      )}

      <div
        className="relative rounded-[10px] bg-white select-none w-full h-full"
        style={{
          border: '1px solid #b8c2cf',
          opacity: dimmed ? 0.42 : 1,
          filter: dimmed ? 'grayscale(.55)' : 'none',
          boxShadow: ring,
        }}
      >
        {/* top-left index */}
        <div className="absolute left-[7%] top-[3.5%] leading-none flex flex-col items-center">
          <span className="font-black leading-none" style={rankStyle}>
            {rank}
          </span>
          <span className="leading-none" style={{ fontSize: rankSize * 0.8, color: ink, marginTop: 1 }}>
            {glyph}
          </span>
        </div>

        {/* centre pip */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontSize: width * 0.56, color: ink, opacity: 0.16 }}>{glyph}</span>
        </div>

        {/* bottom-right index, rotated */}
        <div className="absolute right-[7%] bottom-[3.5%] leading-none flex flex-col items-center rotate-180">
          <span className="font-black leading-none" style={rankStyle}>
            {rank}
          </span>
          <span className="leading-none" style={{ fontSize: rankSize * 0.8, color: ink, marginTop: 1 }}>
            {glyph}
          </span>
        </div>

        {/* corner point value */}
        {points === 'corner' && value > 0 && width >= 40 && (
          <div
            className="absolute rounded-full font-black flex items-center justify-center"
            style={{
              right: 3, top: 3,
              width: width * 0.3, height: width * 0.3,
              fontSize: width * 0.17,
              background: value === 30 ? '#f59e0b' : '#10b981',
              color: value === 30 ? '#241503' : '#04251b',
            }}
          >
            {value}
          </div>
        )}

        {/* partner marker, on the strip that stays visible in a fan */}
        {partner && (
          <div
            className="absolute rounded-full flex items-center justify-center font-black"
            style={{
              left: 3, bottom: 3,
              width: width * 0.3, height: width * 0.3,
              fontSize: width * 0.2,
              background: '#34d399',
              color: '#04251b',
              boxShadow: '0 1px 4px rgba(0,0,0,.4)',
            }}
            title="Partner card"
          >
            ★
          </div>
        )}

        {/* arbitrary text badge */}
        {badge && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-bold shadow-lg"
            style={{
              fontSize: Math.max(9, width * 0.16),
              background: '#374151',
              color: '#f9fafb',
              border: '1.5px solid rgba(255,255,255,.2)',
            }}
          >
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}

/** The back of a card, for opponents' hands. */
export function CardBack({ width = 40 }: { width?: number }) {
  const height = Math.round(width * 1.42);
  return (
    <div
      className="rounded-[8px]"
      style={{
        width,
        height,
        background: 'repeating-linear-gradient(45deg,#1e40af 0 5px,#1d4ed8 5px 10px)',
        border: '1.5px solid #e5e7eb',
        boxShadow: '0 3px 10px rgba(0,0,0,.45)',
      }}
    />
  );
}
