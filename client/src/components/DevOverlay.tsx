// ============================================================
// Developer preview — a small live readout of the game state.
// Rendered only in a dev build, and only when switched on.
// ============================================================

import { useGameStore } from '../store/gameStore';
import { useSettings } from '../store/settingsStore';

export default function DevOverlay() {
  const on = useSettings((s) => s.developerPreview);
  const s = useGameStore();

  if (!import.meta.env.DEV || !on) return null;

  const rows: [string, string][] = [
    ['phase', s.phase],
    ['turn', s.currentTurn?.slice(0, 8) ?? '—'],
    ['bidder', s.currentBidder?.slice(0, 8) ?? '—'],
    ['bid', String(s.highestBid)],
    ['trump', s.trump ?? '—'],
    ['hand', String(s.myHand.length)],
    ['trick', `${s.currentTrick.plays.length}/${s.players.length}`],
    ['done', String(s.completedTricks.length)],
    ['partners', s.revealedPartners.length ? s.revealedPartners.map((p) => p.slice(0, 6)).join(',') : 'none'],
    ['socket', s.connected ? 'up' : 'down'],
  ];

  return (
    <div
      className="fixed left-2 z-[70] rounded-xl px-2 py-1.5 pointer-events-none tabular"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        background: 'rgba(0,0,0,.72)',
        border: '1px solid rgba(255,255,255,.18)',
        fontSize: 10.5,
        lineHeight: 1.45,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-white/45 w-[52px]">{k}</span>
          <span className="text-mint-300">{v}</span>
        </div>
      ))}
    </div>
  );
}
