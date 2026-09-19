// ============================================================
// Create Room — mode, seats, opponents, then straight to the lobby
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Avatar, Button, Chip, Screen, ScreenBody, ScreenFooter, Section, Segment, Spinner, TopBar,
} from '../ui';
import { useGameStore } from '../store/gameStore';
import { createRoom } from '../lib/socket';
import { requiredPartnerCount } from '../lib/cards';
import type { BotDifficulty, GameMode, MatchType } from '../types';
import { buzz } from '../lib/haptics';
import { play } from '../lib/audio';

const MODE_INFO: Record<GameMode, {
  title: string; tag: string; cards: string; bid: string; seats: string; decks: 1 | 2;
}> = {
  classic: {
    title: 'Classic',
    tag: 'One deck, sharp and quick',
    cards: '52 cards',
    bid: 'Bids 125 to 250',
    seats: '4 to 6 players',
    decks: 1,
  },
  '500': {
    title: 'Kadi Teri 500',
    tag: 'Two decks, occurrence rules',
    cards: '104 cards',
    bid: 'Bids 125 to 500',
    seats: '4 to 10 players',
    decks: 2,
  },
};

/** Object key order puts numeric-looking keys first, so state it explicitly. */
const MODE_ORDER: GameMode[] = ['classic', '500'];

function DeckArt({ decks, active }: { decks: 1 | 2; active: boolean }) {
  const faces = decks === 1 ? [0] : [0, 1];
  return (
    <div className="relative h-[78px] w-[86px] shrink-0">
      {faces.map((d) => (
        <div key={d} className="absolute" style={{ left: d * 16, top: d * -4 }}>
          <div
            className="rounded-lg"
            style={{
              width: 54, height: 74,
              background: 'linear-gradient(150deg,#ffffff,#e5e7eb)',
              border: '1px solid #cbd5e1',
              transform: `rotate(${d === 0 ? -8 : 7}deg)`,
              boxShadow: active ? '0 8px 20px rgba(0,0,0,.45)' : '0 4px 12px rgba(0,0,0,.35)',
            }}
          >
            <div className="h-full w-full flex flex-col items-center justify-center">
              <span className="text-[19px] font-black leading-none" style={{ color: d === 0 ? '#111827' : '#dc2626' }}>
                {d === 0 ? 'A' : 'K'}
              </span>
              <span className="text-[17px] leading-none" style={{ color: d === 0 ? '#111827' : '#dc2626' }}>
                {d === 0 ? '♠' : '♥'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CreateRoom() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const solo = params.get('solo') === '1';

  const roomCode = useGameStore((s) => s.roomCode);
  const errorNonce = useGameStore((s) => s.errorNonce);
  const name = useGameStore((s) => s.myPlayerName);
  const avatar = useGameStore((s) => s.myAvatar);

  const [mode, setMode] = useState<GameMode>('classic');
  const [playerCount, setPlayerCount] = useState(4);
  const [matchType, setMatchType] = useState<MatchType>(solo ? 'bots' : 'humans');
  const [botCount, setBotCount] = useState(solo ? 3 : 0);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [busy, setBusy] = useState(false);

  const seatOptions = useMemo(
    () => (mode === 'classic' ? [4, 5, 6] : [4, 5, 6, 7, 8, 9, 10]),
    [mode],
  );

  // Keep the seat count inside the range the chosen mode allows.
  useEffect(() => {
    if (!seatOptions.includes(playerCount)) setPlayerCount(seatOptions[0]);
  }, [seatOptions, playerCount]);

  // Bots are derived from the match type, so the numbers always add up.
  useEffect(() => {
    if (matchType === 'humans') setBotCount(0);
    else if (matchType === 'bots') setBotCount(playerCount - 1);
    else setBotCount((n) => Math.min(Math.max(n || 1, 1), playerCount - 2));
  }, [matchType, playerCount]);

  // The room exists and the host is already seated in it.
  useEffect(() => {
    if (busy && roomCode) navigate('/lobby', { replace: true });
  }, [busy, roomCode, navigate]);

  useEffect(() => {
    if (errorNonce > 0) setBusy(false);
  }, [errorNonce]);

  const humanCount = playerCount - botCount;
  const partners = requiredPartnerCount(mode, playerCount);
  const maxBots = matchType === 'bots' ? playerCount - 1 : playerCount - 2;

  const submit = () => {
    setBusy(true);
    createRoom({ mode, playerCount, matchType, botCount, botDifficulty: difficulty });
  };

  return (
    <Screen>
      <TopBar
        title="New room"
        subtitle="Set the table, then invite"
        onBack={() => navigate('/')}
        right={<Avatar name={name || '?'} index={avatar} size={40} />}
      />

      <ScreenBody className="px-5 pt-2">
        {/* ── Step 1: game mode ───────────────────────────── */}
        <Section step={1} title="Game mode">
          <div className="flex flex-col gap-3">
            {MODE_ORDER.map((m) => {
              const info = MODE_INFO[m];
              const active = mode === m;
              return (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { play('tap'); buzz('light'); setMode(m); }}
                  className="w-full rounded-3xl p-4 flex items-center gap-4 text-left transition-colors"
                  style={active
                    ? { background: 'linear-gradient(135deg, rgba(245,158,11,.22), rgba(245,158,11,.08))', border: '1.5px solid rgba(251,191,36,.75)', boxShadow: '0 10px 30px rgba(245,158,11,.18)' }
                    : { background: 'rgba(255,255,255,.06)', border: '1.5px solid rgba(255,255,255,.12)' }}
                >
                  <DeckArt decks={info.decks} active={active} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[18px] font-extrabold">{info.title}</span>
                      {active && (
                        <span className="w-5 h-5 rounded-full bg-gold-400 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M5 13l4 4L19 7" stroke="#241503" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="text-[13.5px] text-white/60 mt-0.5">{info.tag}</div>
                    <div className="text-[12.5px] text-white/45 mt-1.5">
                      {info.cards} · {info.seats}
                    </div>
                    <div className="text-[12.5px] text-white/45">{info.bid}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Section>

        {/* ── Step 2: seats ───────────────────────────────── */}
        <Section
          step={2}
          title="Players at the table"
          hint={`${partners} partner card${partners > 1 ? 's' : ''} at this size.`}
        >
          <div className="flex flex-wrap gap-3">
            {seatOptions.map((n) => (
              <Chip
                key={n}
                label={n}
                sub="seats"
                selected={playerCount === n}
                onClick={() => setPlayerCount(n)}
              />
            ))}
          </div>
        </Section>

        {/* ── Step 3: who is playing ──────────────────────── */}
        <Section step={3} title="Who is playing">
          <div className="flex flex-col gap-2.5">
            {([
              { v: 'humans' as MatchType, title: 'Human players', desc: 'Every seat waits for a real person' },
              { v: 'mixed' as MatchType, title: 'Humans and bots', desc: 'Fill the empty seats with AI' },
              { v: 'bots' as MatchType, title: 'Bots only', desc: 'You against the table, no waiting' },
            ]).map((o) => {
              const active = matchType === o.v;
              const disabled = o.v === 'mixed' && playerCount < 3;
              return (
                <button
                  key={o.v}
                  disabled={disabled}
                  onClick={() => { play('tap'); buzz('light'); setMatchType(o.v); }}
                  className="w-full rounded-2xl px-4 py-3.5 flex items-center gap-3.5 text-left"
                  style={active
                    ? { background: 'rgba(16,185,129,.16)', border: '1.5px solid rgba(52,211,153,.7)' }
                    : { background: 'rgba(255,255,255,.055)', border: '1.5px solid rgba(255,255,255,.1)', opacity: disabled ? 0.4 : 1 }}
                >
                  <span
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
                    style={{ border: `2px solid ${active ? '#34d399' : 'rgba(255,255,255,.3)'}` }}
                  >
                    {active && <span className="w-3 h-3 rounded-full bg-mint-400" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16px] font-bold">{o.title}</span>
                    <span className="block text-[13px] text-white/55">{o.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {matchType === 'mixed' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 rounded-2xl surface p-4"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[15px] font-bold">Bots at the table</span>
                <span className="text-[15px] font-black text-gold-300 tabular">{botCount}</span>
              </div>
              <p className="text-[13px] text-white/50 mb-3">
                {humanCount} human seat{humanCount === 1 ? '' : 's'} left open for invites.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  size="sm" variant="ghost" full={false}
                  disabled={botCount <= 1}
                  onClick={() => setBotCount((n) => Math.max(1, n - 1))}
                  className="!w-[52px] !px-0 text-[22px]"
                >
                  −
                </Button>
                <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(botCount / Math.max(maxBots, 1)) * 100}%`,
                      background: 'linear-gradient(90deg,#fbbf24,#d97706)',
                    }}
                  />
                </div>
                <Button
                  size="sm" variant="ghost" full={false}
                  disabled={botCount >= maxBots}
                  onClick={() => setBotCount((n) => Math.min(maxBots, n + 1))}
                  className="!w-[52px] !px-0 text-[22px]"
                >
                  +
                </Button>
              </div>
            </motion.div>
          )}

          {botCount > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mb-2">
                Bot difficulty
              </p>
              <Segment
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
              <p className="text-[13px] text-white/50 mt-2.5 leading-snug">
                {difficulty === 'easy' && 'Plays any legal card and folds early in the auction.'}
                {difficulty === 'medium' && 'Protects point cards and bids close to its hand value.'}
                {difficulty === 'hard' && 'Counts points, pulls trumps, and holds partner cards back to stay hidden.'}
              </p>
            </div>
          )}
        </Section>

        <div className="h-4" />
      </ScreenBody>

      <ScreenFooter>
        <div className="flex items-center justify-center gap-2 mb-3 text-[13.5px] text-white/60">
          <span className="font-bold text-white">{playerCount} players</span>
          <span className="opacity-40">·</span>
          <span>{humanCount} human{humanCount === 1 ? '' : 's'}</span>
          <span className="opacity-40">·</span>
          <span>{botCount} bot{botCount === 1 ? '' : 's'}</span>
        </div>
        <Button onClick={submit} disabled={busy} icon={busy ? <Spinner size={18} /> : undefined}>
          {busy ? 'Creating room' : 'Create room'}
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
