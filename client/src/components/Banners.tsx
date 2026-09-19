// ============================================================
// Transient banners — errors, reveals, trick results
// ============================================================

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

const STYLE = {
  error:  { background: 'linear-gradient(180deg,#f87171,#dc2626)', color: '#fff' },
  reveal: { background: 'linear-gradient(180deg,#fcd34d,#d97706)', color: '#2a1803' },
  trick:  { background: 'rgba(17,24,39,.9)', color: '#e5e7eb' },
  info:   { background: 'rgba(17,24,39,.9)', color: '#e5e7eb' },
} as const;

const LIFETIME = { error: 3600, reveal: 3200, trick: 1800, info: 2400 } as const;

export default function Banners() {
  const banners = useGameStore((s) => s.banners);
  const dismiss = useGameStore((s) => s.dismissBanner);

  useEffect(() => {
    if (!banners.length) return;
    const timers = banners.map((b) =>
      window.setTimeout(() => dismiss(b.id), LIFETIME[b.kind]),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [banners, dismiss]);

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
      // Sits below the top bar so the trump badge and contract stay readable.
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 62px)' }}
    >
      <AnimatePresence initial={false}>
        {banners.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            onClick={() => dismiss(b.id)}
            className="pointer-events-auto max-w-[360px] w-full rounded-2xl px-4 py-3 text-[14.5px] font-semibold text-center"
            style={{ ...STYLE[b.kind], boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}
          >
            {b.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
