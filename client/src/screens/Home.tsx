// ============================================================
// Home — the first thing anyone sees
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, Button, Screen } from '../ui';
import ProfileSheet from '../components/ProfileSheet';
import { useGameStore } from '../store/gameStore';
import { unlockAudio } from '../lib/audio';

function FloatingCard({
  rank,
  suit,
  red,
  style,
  rotate,
  delay,
}: {
  rank: string;
  suit: string;
  red?: boolean;
  style: React.CSSProperties;
  rotate: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -24, rotate }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ delay, type: 'spring', stiffness: 160, damping: 18 }}
      className="absolute float-slow"
      style={{ ...style, ['--r' as string]: `${rotate}deg` }}
    >
      <div
        className="rounded-xl bg-white flex flex-col items-center justify-center card-shadow"
        style={{ width: 64, height: 90, border: '1px solid #d1d5db' }}
      >
        <span
          className="font-black leading-none"
          style={{ fontSize: 24, color: red ? '#dc2626' : '#111827' }}
        >
          {rank}
        </span>
        <span
          className="leading-none mt-0.5"
          style={{ fontSize: 22, color: red ? '#dc2626' : '#111827' }}
        >
          {suit}
        </span>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const name = useGameStore((s) => s.myPlayerName);
  const avatar = useGameStore((s) => s.myAvatar);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pending, setPending] = useState<null | string>(null);

  const go = (path: string) => {
    unlockAudio();
    if (!name.trim()) { setPending(path); setProfileOpen(true); return; }
    navigate(path);
  };

  return (
    <Screen>
      {/* header row */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-3">
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2.5 h-12 pl-1 pr-4 rounded-full surface active:scale-95 transition-transform"
        >
          <Avatar name={name || '?'} index={avatar} size={38} />
          <span className="text-[15px] font-bold max-w-[120px] truncate">
            {name || 'Set name'}
          </span>
        </button>

        <button
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          className="w-12 h-12 rounded-full surface flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
            <path
              d="M19.4 14.5a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.55-1.1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1.5z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* hero */}
      <div className="relative shrink-0 h-[268px]">
        <FloatingCard rank="A" suit="♠" rotate={-12} delay={0.05} style={{ left: 22, top: 40 }} />
        <FloatingCard rank="K" suit="♥" red rotate={10} delay={0.16} style={{ right: 22, top: 52 }} />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="absolute inset-x-0 bottom-2 text-center px-6"
        >
          <h1
            className="text-gold-gradient font-black tracking-[0.02em] leading-none"
            style={{ fontSize: 46 }}
          >
            KADI TERI
          </h1>
          <p className="text-accent-soft text-[14px] font-semibold mt-2.5 tracking-wide">
            Hidden Partnership Card Game
          </p>
        </motion.div>
      </div>

      {/* actions */}
      <div className="flex-1 min-h-0 flex flex-col justify-center px-6 gap-3.5 pb-2">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Button variant="gold" onClick={() => go('/create')} className="sheen relative overflow-hidden">
            Create Room
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          <Button variant="royal" onClick={() => go('/join')}>
            Join Room
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
          <Button variant="slate" onClick={() => go('/create?solo=1')}>
            Play with Bots
          </Button>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate('/rules')}
          className="h-12 mt-1 text-[15px] font-bold text-accent-dim active:scale-95 transition-transform"
        >
          How to play
        </motion.button>
      </div>

      <div className="shrink-0 pb-6 text-center">
        <p className="text-[12.5px] text-accent-dim font-medium tracking-wide">
          Classic · 500 Edition · Multiplayer
        </p>
      </div>

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={() => { if (pending) { navigate(pending); setPending(null); } }}
      />
    </Screen>
  );
}
