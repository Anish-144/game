// ============================================================
// Lobby — the host is already seated, invites go out from here
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button, Screen, ScreenBody, ScreenFooter, Spinner, TopBar } from '../ui';
import Sheet from '../ui/Sheet';
import QrCode, { useQrSvg } from '../components/QrCode';
import Reconnecting from '../components/Reconnecting';
import { useGameStore } from '../store/gameStore';
import { addBot, leaveRoom, removeBot, requestInvite, startGame } from '../lib/socket';
import { copyText, canShare, inviteLink, shareInvite, shareQr } from '../lib/invite';
import { requiredPartnerCount } from '../lib/cards';
import { buzz } from '../lib/haptics';
import type { BotDifficulty } from '../types';

const DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard',
};

export default function Lobby() {
  const navigate = useNavigate();
  const roomCode = useGameStore((s) => s.roomCode);
  const config = useGameStore((s) => s.config);
  const players = useGameStore((s) => s.players);
  const phase = useGameStore((s) => s.phase);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const connected = useGameStore((s) => s.connected);
  const rejoining = useGameStore((s) => s.rejoining);
  const stoppedReason = useGameStore((s) => s.stoppedReason);
  const clearStoppedReason = useGameStore((s) => s.clearStoppedReason);
  const invite = useGameStore((s) => s.invite);

  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [starting, setStarting] = useState(false);

  // The server is asked for the canonical invite, with a local fallback.
  const link = invite?.roomCode === roomCode ? invite.link : roomCode ? inviteLink(roomCode) : '';
  const qrSvg = useQrSvg(link, 230);

  const isHost = !!config && config.hostId === myPlayerId;
  const seats = config?.playerCount ?? 4;
  const full = players.length >= seats;
  const humans = players.filter((p) => !p.isBot).length;
  const bots = players.length - humans;
  const partners = config ? requiredPartnerCount(config.mode, config.playerCount) : 1;

  const rows = useMemo(
    () => Array.from({ length: seats }, (_, i) => players[i] ?? null),
    [seats, players],
  );

  useEffect(() => {
    if (!roomCode && !rejoining) navigate('/', { replace: true });
  }, [roomCode, rejoining, navigate]);

  useEffect(() => {
    if (phase !== 'waiting') navigate('/game', { replace: true });
  }, [phase, navigate]);

  useEffect(() => {
    if (roomCode) requestInvite();
  }, [roomCode]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!roomCode && rejoining) return <Reconnecting />;

  if (!roomCode || !config) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center"><Spinner size={30} /></div>
      </Screen>
    );
  }

  const doCopyCode = async () => {
    buzz('light');
    if (await copyText(roomCode)) setCopied('code');
  };

  const doShareLink = async () => {
    buzz('light');
    if (canShare()) {
      if (await shareInvite(roomCode)) return;
    }
    if (await copyText(link)) setCopied('link');
  };

  return (
    <Screen>
      <TopBar
        title={`Room ${roomCode}`}
        subtitle={`${config.mode === '500' ? 'Kadi Teri 500' : 'Classic'} · ${partners} partner card${partners > 1 ? 's' : ''}`}
        onBack={() => { leaveRoom(); navigate('/'); }}
        right={
          isHost ? (
            <span className="h-9 px-3.5 rounded-full surface-gold text-gold-200 text-[13px] font-bold flex items-center">
              Host
            </span>
          ) : undefined
        }
      />

      <ScreenBody className="px-5">
        {stoppedReason && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={clearStoppedReason}
            className="w-full rounded-2xl px-4 py-3 mb-4 text-left"
            style={{ background: 'rgba(245,158,11,.16)', border: '1px solid rgba(251,191,36,.45)' }}
          >
            <div className="text-[12px] font-bold uppercase tracking-wider text-gold-200/80 mb-0.5">
              Last game ended early
            </div>
            <div className="text-[14.5px] font-semibold">{stoppedReason}</div>
            <div className="text-[12.5px] text-white/45 mt-1">Tap to dismiss</div>
          </motion.button>
        )}

        {/* ── room code card ──────────────────────────────── */}
        <button
          onClick={doCopyCode}
          className="w-full rounded-3xl p-5 mb-5 text-left active:scale-[.99] transition-transform"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,.18), rgba(245,158,11,.05))',
            border: '1.5px solid rgba(251,191,36,.45)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12.5px] font-bold uppercase tracking-widest text-gold-200/80">
              Room code
            </span>
            <span className="text-[13px] font-bold text-white/55 tabular">
              {players.length} / {seats} seated
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[38px] font-black tabular tracking-[.14em] text-gold-gradient leading-tight">
              {roomCode}
            </span>
            <span className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              {copied === 'code' ? <CheckIcon /> : <CopyIcon />}
            </span>
          </div>
          <div className="text-[13px] text-white/50 mt-1">
            {humans} human{humans === 1 ? '' : 's'} · {bots} bot{bots === 1 ? '' : 's'}
            {copied === 'code' && <span className="text-mint-300 font-bold"> · copied</span>}
          </div>
        </button>

        {/* ── seats ───────────────────────────────────────── */}
        <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mb-2.5">
          Seats
        </p>

        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {rows.map((player, i) => (
              <motion.div
                key={player?.id ?? `empty-${i}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="rounded-2xl px-3.5 h-[68px] flex items-center gap-3.5"
                style={player
                  ? { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)' }
                  : { background: 'rgba(255,255,255,.025)', border: '1px dashed rgba(255,255,255,.18)' }}
              >
                {player ? (
                  <>
                    <Avatar
                      name={player.name}
                      index={player.avatar}
                      isBot={player.isBot}
                      size={44}
                      dimmed={!player.isConnected}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[16.5px] font-bold truncate">{player.name}</span>
                        {player.id === myPlayerId && (
                          <span className="text-[12px] font-bold text-mint-300 shrink-0">you</span>
                        )}
                      </div>
                      <div className="text-[13px] text-white/50">
                        {player.takenOver
                          ? 'Left · bot finishing the round'
                          : player.id === config.hostId
                            ? 'Host · seat 1'
                            : player.isBot
                              ? `Bot · ${DIFFICULTY_LABEL[player.difficulty ?? config.botDifficulty]}`
                              : `Seat ${i + 1}${player.isConnected ? '' : ' · offline'}`}
                      </div>
                    </div>
                    {isHost && player.isBot && (
                      <button
                        onClick={() => { buzz('medium'); removeBot(player.id); }}
                        aria-label={`Remove ${player.name}`}
                        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                        style={{ background: 'rgba(239,68,68,.16)', border: '1px solid rgba(239,68,68,.35)' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" stroke="#fca5a5" strokeWidth="2.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center"
                      style={{ border: '1.5px dashed rgba(255,255,255,.25)' }}
                    >
                      <Spinner size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-semibold text-white/55">Waiting…</div>
                      <div className="text-[13px] text-white/35">Seat {i + 1} is open</div>
                    </div>
                    {isHost && (
                      <button
                        onClick={() => { buzz('light'); addBot(); }}
                        className="h-11 px-4 rounded-full text-[14px] font-bold shrink-0 active:scale-95 transition-transform"
                        style={{ background: 'rgba(59,130,246,.18)', border: '1px solid rgba(96,165,250,.45)', color: '#bfdbfe' }}
                      >
                        + Bot
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="h-5" />
      </ScreenBody>

      <ScreenFooter>
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <SmallAction label={copied === 'code' ? 'Copied' : 'Copy code'} onClick={doCopyCode} icon={<CopyIcon />} />
          <SmallAction label={copied === 'link' ? 'Copied' : 'Share link'} onClick={doShareLink} icon={<LinkIcon />} />
          <SmallAction label="Share QR" onClick={() => { buzz('light'); setQrOpen(true); }} icon={<QrIcon />} />
        </div>

        {isHost ? (
          <Button
            onClick={() => { setStarting(true); startGame(); }}
            disabled={!full || starting || !connected}
            icon={starting ? <Spinner size={18} /> : undefined}
          >
            {full ? (starting ? 'Dealing' : 'Start game') : `Waiting for ${seats - players.length} more`}
          </Button>
        ) : (
          <div className="h-[60px] rounded-[30px] surface flex items-center justify-center gap-3 text-[16px] font-bold text-white/65">
            <Spinner size={18} />
            {full ? 'Waiting for the host to start' : `Waiting for ${seats - players.length} more`}
          </div>
        )}
      </ScreenFooter>

      {/* ── QR sheet ──────────────────────────────────────── */}
      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title="Invite to this room">
        <div className="flex flex-col items-center gap-5 pb-2">
          <QrCode value={link} size={220} caption="Scan from the Join Room screen on another phone." />

          <div className="w-full rounded-2xl surface px-4 py-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white/45 mb-1">
              Invite link
            </div>
            <div className="text-[14px] font-semibold break-all text-mint-200">{link}</div>
          </div>

          <div className="w-full flex flex-col gap-2.5">
            <Button
              variant="gold"
              size="md"
              onClick={async () => {
                if (!(await shareQr(roomCode, qrSvg))) {
                  if (await copyText(link)) setCopied('link');
                }
              }}
            >
              Share QR image
            </Button>
            <Button variant="ghost" size="md" onClick={doShareLink}>
              {canShare() ? 'Share link' : 'Copy link'}
            </Button>
          </div>
        </div>
      </Sheet>
    </Screen>
  );
}

function SmallAction({
  label, onClick, icon,
}: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="h-[58px] rounded-2xl surface flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
    >
      <span className="opacity-80">{icon}</span>
      <span className="text-[12.5px] font-bold">{label}</span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.4" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V6a2 2 0 012-2h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 13a5 5 0 007.5.5l3-3A5 5 0 0013.5 3.5l-1.7 1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11a5 5 0 00-7.5-.5l-3 3A5 5 0 0010.5 20.5l1.7-1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2zM19 14h2v2h-2z" fill="currentColor" />
    </svg>
  );
}
