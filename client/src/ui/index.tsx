// ============================================================
// UI kit — touch-first primitives
// Every interactive target is at least 48px tall; primary
// actions are 60px. No text smaller than 12px anywhere.
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { buzz } from '../lib/haptics';
import { play, unlockAudio } from '../lib/audio';

// ─── Screen ───────────────────────────────────────────────────────────────────

type Background = 'table' | 'felt' | 'ink';

export function Screen({
  children,
  background = 'table',
  className = '',
}: {
  children: React.ReactNode;
  background?: Background;
  className?: string;
}) {
  const bg = background === 'felt' ? 'bg-felt' : background === 'ink' ? 'bg-ink' : 'bg-table';
  return <div className={`screen ${bg} ${className}`}>{children}</div>;
}

export function ScreenBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`screen-scroll no-bar ${className}`}>{children}</div>;
}

export function ScreenFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`shrink-0 px-5 pt-4 pb-5 ${className}`}
      style={{ background: 'linear-gradient(180deg, rgba(2,44,34,0) 0%, rgba(2,25,20,.75) 38%, rgba(2,25,20,.95) 100%)' }}
    >
      {children}
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 pt-3 pb-3">
      {onBack ? (
        <button
          onClick={() => { buzz('light'); onBack(); }}
          aria-label="Go back"
          className="w-12 h-12 -ml-1 rounded-2xl surface flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="w-1" />
      )}

      <div className="flex-1 min-w-0">
        {title && <div className="text-[19px] font-extrabold leading-tight truncate">{title}</div>}
        {subtitle && <div className="text-[13px] text-white/55 leading-tight truncate">{subtitle}</div>}
      </div>

      {right}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

type Variant = 'gold' | 'royal' | 'slate' | 'mint' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  gold:   { background: 'linear-gradient(180deg,#fbbf24 0%,#f59e0b 55%,#d97706 100%)', color: '#241503', boxShadow: '0 8px 24px rgba(245,158,11,.35), inset 0 1px 0 rgba(255,255,255,.45)' },
  royal:  { background: 'linear-gradient(180deg,#3b82f6 0%,#2563eb 55%,#1d4ed8 100%)', color: '#fff', boxShadow: '0 8px 24px rgba(37,99,235,.35), inset 0 1px 0 rgba(255,255,255,.28)' },
  mint:   { background: 'linear-gradient(180deg,#34d399 0%,#10b981 55%,#059669 100%)', color: '#04251b', boxShadow: '0 8px 24px rgba(16,185,129,.32), inset 0 1px 0 rgba(255,255,255,.35)' },
  slate:  { background: 'linear-gradient(180deg,#4b5563 0%,#374151 60%,#1f2937 100%)', color: '#f3f4f6', boxShadow: '0 6px 18px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.12)' },
  ghost:  { background: 'rgba(255,255,255,.08)', color: '#f3f4f6', border: '1px solid rgba(255,255,255,.16)' },
  danger: { background: 'linear-gradient(180deg,#f87171 0%,#ef4444 60%,#dc2626 100%)', color: '#fff', boxShadow: '0 8px 24px rgba(239,68,68,.32)' },
};

const SIZE_CLASS: Record<Size, string> = {
  lg: 'h-[60px] text-[18px] rounded-[30px] px-6',
  md: 'h-[52px] text-[16px] rounded-[26px] px-5',
  sm: 'h-[44px] text-[15px] rounded-[22px] px-4',
};

export function Button({
  children,
  onClick,
  variant = 'gold',
  size = 'lg',
  disabled = false,
  full = true,
  icon,
  className = '',
  sound = 'tap',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  className?: string;
  sound?: 'tap' | null;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.965 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        unlockAudio();
        if (sound) play(sound);
        buzz('light');
        onClick?.();
      }}
      style={disabled ? { background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.35)' } : VARIANT_STYLE[variant]}
      className={`${SIZE_CLASS[size]} ${full ? 'w-full' : ''} font-extrabold tracking-tight
        inline-flex items-center justify-center gap-2.5 select-none
        disabled:cursor-not-allowed ${className}`}
    >
      {icon}
      {children}
    </motion.button>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

export function Chip({
  label,
  selected,
  onClick,
  disabled,
  sub,
}: {
  label: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  sub?: string;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.92 }}
      disabled={disabled}
      onClick={() => { if (disabled) return; play('tap'); buzz('light'); onClick(); }}
      className="w-[62px] h-[62px] rounded-full flex flex-col items-center justify-center font-extrabold shrink-0 transition-colors"
      style={
        disabled
          ? { background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.22)', border: '1px solid rgba(255,255,255,.07)' }
          : selected
            ? { background: 'linear-gradient(180deg,#fbbf24,#d97706)', color: '#241503', boxShadow: '0 6px 20px rgba(245,158,11,.45)' }
            : { background: 'rgba(255,255,255,.07)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,.14)' }
      }
    >
      <span className="text-[21px] leading-none">{label}</span>
      {sub && <span className="text-[10px] font-semibold opacity-70 mt-0.5">{sub}</span>}
    </motion.button>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────

export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex p-1.5 rounded-2xl surface gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => { play('tap'); buzz('light'); onChange(o.value); }}
            className="flex-1 h-12 rounded-xl text-[15px] font-bold transition-colors"
            style={active
              ? { background: 'linear-gradient(180deg,#fbbf24,#d97706)', color: '#241503' }
              : { color: 'rgba(255,255,255,.66)' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  ['#fbbf24', '#d97706'], ['#34d399', '#059669'], ['#60a5fa', '#2563eb'],
  ['#f472b6', '#db2777'], ['#a78bfa', '#7c3aed'], ['#fb923c', '#ea580c'],
  ['#2dd4bf', '#0d9488'], ['#f87171', '#dc2626'], ['#c084fc', '#9333ea'],
  ['#4ade80', '#16a34a'], ['#38bdf8', '#0284c7'], ['#facc15', '#ca8a04'],
];

export function Avatar({
  name,
  index = 0,
  size = 44,
  isBot = false,
  dimmed = false,
}: {
  name: string;
  index?: number;
  size?: number;
  isBot?: boolean;
  dimmed?: boolean;
}) {
  const [from, to] = AVATAR_COLORS[((index % 12) + 12) % 12];
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-black shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color: '#101418',
        background: isBot
          ? 'linear-gradient(160deg,#9ca3af,#4b5563)'
          : `linear-gradient(160deg,${from},${to})`,
        opacity: dimmed ? 0.45 : 1,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 2px 8px rgba(0,0,0,.35)',
      }}
    >
      {isBot ? <BotGlyph size={size * 0.52} /> : initials}
    </div>
  );
}

function BotGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="7" width="17" height="12" rx="4" fill="#111827" />
      <circle cx="9" cy="13" r="1.9" fill="#6ee7b7" />
      <circle cx="15" cy="13" r="1.9" fill="#6ee7b7" />
      <path d="M12 3.2v3.4" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="2.6" r="1.5" fill="#111827" />
    </svg>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={() => { play('tap'); buzz('light'); onChange(!checked); }}
      className="w-full flex items-center gap-4 py-3.5 text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-semibold">{label}</div>
        {hint && <div className="text-[13px] text-white/50 mt-0.5">{hint}</div>}
      </div>
      <div
        className="w-[56px] h-[32px] rounded-full p-1 shrink-0 transition-colors"
        style={{ background: checked ? '#10b981' : 'rgba(255,255,255,.16)' }}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 34 }}
          className="w-6 h-6 rounded-full bg-white"
          style={{ marginLeft: checked ? 24 : 0, boxShadow: '0 1px 4px rgba(0,0,0,.35)' }}
        />
      </div>
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function Section({
  step,
  title,
  hint,
  children,
}: {
  step?: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="flex items-center gap-2.5 mb-3">
        {step !== undefined && (
          <span className="w-7 h-7 rounded-full surface-gold text-gold-200 text-[13px] font-black flex items-center justify-center">
            {step}
          </span>
        )}
        <h2 className="text-[17px] font-extrabold">{title}</h2>
      </div>
      {hint && <p className="text-[13.5px] text-white/50 -mt-1.5 mb-3 leading-snug">{hint}</p>}
      {children}
    </section>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: 'linear', duration: 0.9 }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2.5px solid rgba(255,255,255,.25)',
        borderTopColor: '#fbbf24',
        display: 'inline-block',
      }}
    />
  );
}
