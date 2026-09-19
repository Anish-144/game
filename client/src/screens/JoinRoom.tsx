// ============================================================
// Join Room — code, invite link, or QR scan
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, Button, Screen, ScreenBody, Spinner, TopBar } from '../ui';
import QrScanner from '../components/QrScanner';
import ProfileSheet from '../components/ProfileSheet';
import { useGameStore } from '../store/gameStore';
import { joinRoom } from '../lib/socket';
import { parseRoomCode } from '../lib/invite';
import { buzz } from '../lib/haptics';

const LENGTH = 6;

export default function JoinRoom() {
  const navigate = useNavigate();
  const { code: codeFromUrl } = useParams<{ code: string }>();

  const roomCode = useGameStore((s) => s.roomCode);
  const errorNonce = useGameStore((s) => s.errorNonce);
  const error = useGameStore((s) => s.error);
  const name = useGameStore((s) => s.myPlayerName);
  const avatar = useGameStore((s) => s.myAvatar);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pasteFailed, setPasteFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoTried = useRef(false);

  const attempt = useCallback((raw: string) => {
    const parsed = parseRoomCode(raw);
    if (!parsed) return false;
    setCode(parsed);
    if (!useGameStore.getState().myPlayerName.trim()) {
      setProfileOpen(true);
      return true;
    }
    setBusy(true);
    joinRoom(parsed);
    return true;
  }, []);

  // A shared link drops straight into the room.
  useEffect(() => {
    if (codeFromUrl && !autoTried.current) {
      autoTried.current = true;
      attempt(codeFromUrl);
    }
  }, [codeFromUrl, attempt]);

  useEffect(() => {
    if (busy && roomCode) navigate('/lobby', { replace: true });
  }, [busy, roomCode, navigate]);

  useEffect(() => {
    if (errorNonce > 0) setBusy(false);
  }, [errorNonce]);

  const onPaste = async () => {
    buzz('light');
    try {
      const text = await navigator.clipboard.readText();
      if (!attempt(text)) setPasteFailed(true);
    } catch {
      setPasteFailed(true);
      inputRef.current?.focus();
    }
  };

  const boxes = Array.from({ length: LENGTH }, (_, i) => code[i] ?? '');

  return (
    <Screen>
      <TopBar
        title="Join a room"
        subtitle="Code, link, or QR"
        onBack={() => navigate('/')}
        right={<Avatar name={name || '?'} index={avatar} size={40} />}
      />

      <ScreenBody className="px-5 pt-4">
        {/* ── Option A: the code ──────────────────────────── */}
        <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mb-3">
          Room code
        </p>

        <div className="relative mb-2">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => {
              const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LENGTH);
              setCode(next);
              if (next.length === LENGTH) buzz('light');
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === LENGTH) attempt(code); }}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Room code"
            className="absolute inset-0 w-full h-full opacity-0 z-10"
          />
          <div className="flex gap-2 justify-between pointer-events-none">
            {boxes.map((ch, i) => {
              const active = i === Math.min(code.length, LENGTH - 1);
              return (
                <div
                  key={i}
                  className="flex-1 h-[62px] rounded-2xl flex items-center justify-center text-[26px] font-black tabular"
                  style={{
                    background: 'rgba(255,255,255,.07)',
                    border: `1.5px solid ${ch ? 'rgba(251,191,36,.8)' : active ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.12)'}`,
                    color: ch ? '#fcd34d' : 'rgba(255,255,255,.3)',
                  }}
                >
                  {ch || '·'}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[13px] text-white/45 mb-5">
          Six characters, shown on the host screen.
        </p>

        <Button
          onClick={() => attempt(code)}
          disabled={code.length !== LENGTH || busy}
          icon={busy ? <Spinner size={18} /> : undefined}
        >
          {busy ? 'Joining' : 'Join room'}
        </Button>

        {error && !busy && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[14px] text-red-300 font-semibold text-center mt-3"
          >
            {error}
          </motion.p>
        )}

        {/* ── Options B and C ─────────────────────────────── */}
        <div className="flex items-center gap-3 my-7">
          <span className="flex-1 h-px bg-white/12" />
          <span className="text-[12.5px] font-bold uppercase tracking-wider text-white/35">or</span>
          <span className="flex-1 h-px bg-white/12" />
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="royal" size="md" onClick={onPaste} icon={<LinkIcon />}>
            Paste invite link
          </Button>
          <Button variant="slate" size="md" onClick={() => { buzz('light'); setScanning(true); }} icon={<QrIcon />}>
            Scan QR code
          </Button>
        </div>

        {pasteFailed && (
          <p className="text-[13px] text-white/50 text-center mt-3">
            Clipboard access was blocked. Type the six characters instead.
          </p>
        )}

        <div className="h-8" />
      </ScreenBody>

      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onResult={(text) => {
            setScanning(false);
            if (!attempt(text)) useGameStore.getState().pushBanner('error', 'That QR code is not a Kadi Teri invite');
          }}
        />
      )}

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={() => { if (code.length === LENGTH) { setBusy(true); joinRoom(code); } }}
      />
    </Screen>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 13a5 5 0 007.5.5l3-3A5 5 0 0013.5 3.5l-1.7 1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11a5 5 0 00-7.5-.5l-3 3A5 5 0 0010.5 20.5l1.7-1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2zM19 14h2v2h-2z" fill="currentColor" />
    </svg>
  );
}
