// ============================================================
// Game — the table, the hand, and whichever phase panel is live
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, Button, Screen, Spinner } from '../ui';
import Sheet from '../ui/Sheet';
import Table from '../components/game/Table';
import HandFan from '../components/game/HandFan';
import PlayingCard from '../components/game/PlayingCard';
import { BidPanel, PartnerPanel, TrumpPanel, WaitingDock } from '../components/game/Panels';
import Reconnecting from '../components/Reconnecting';
import DevOverlay from '../components/DevOverlay';
import { useGameStore } from '../store/gameStore';
import { useGame } from '../hooks/useGame';
import {
  castEndVote, leaveRoom, passBid, placeBid, playCard,
  proposeEndGame, selectPartners, selectTrump,
} from '../lib/socket';
import { SUIT_GLYPH, SUIT_LABEL, partnerLabel, sortHand } from '../lib/cards';
import { useSettings } from '../store/settingsStore';
import type { Card, Suit } from '../types';

const SUIT_TINT: Record<string, string> = {
  spades: '#e5e7eb', hearts: '#fca5a5', diamonds: '#fcd34d', clubs: '#6ee7b7',
};

export default function Game() {
  const navigate = useNavigate();
  const s = useGameStore();
  const g = useGame();
  const sortEnabled = useSettings((st) => st.sortHand);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!s.roomCode && !s.rejoining) navigate('/', { replace: true });
  }, [s.roomCode, s.rejoining, navigate]);

  useEffect(() => {
    if (s.phase === 'scoring') navigate('/score', { replace: true });
    if (s.phase === 'waiting') navigate('/lobby', { replace: true });
  }, [s.phase, navigate]);

  if (!s.roomCode && s.rejoining) return <Reconnecting />;

  if (!s.config) {
    return (
      <Screen background="felt">
        <div className="flex-1 flex items-center justify-center"><Spinner size={30} /></div>
      </Screen>
    );
  }

  // If a bot took this seat over, the person watches the round out.
  const botHasMySeat = !!g.me?.takenOver;
  // Nobody can join a full table of bots, so its code is not worth showing.
  const soloTable = s.players.filter((p) => !p.isBot).length <= 1;
  const showFan = s.phase === 'playing';
  const showStrip = s.phase === 'bidding' || s.phase === 'trump_selection';

  return (
    <Screen background="felt">
      {/* ── top bar ─────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 pt-2.5 pb-2">
        <div
          className="h-11 pl-1.5 pr-3 rounded-full flex items-center gap-2 shrink-0"
          style={{ background: 'rgba(11,17,24,.6)', border: '1px solid rgba(255,255,255,.14)' }}
        >
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-[19px]"
            style={{
              background: s.trump ? 'linear-gradient(180deg,#fbbf24,#d97706)' : 'rgba(255,255,255,.1)',
              color: s.trump ? '#1b1205' : 'rgba(255,255,255,.4)',
            }}
          >
            {s.trump ? SUIT_GLYPH[s.trump] : '?'}
          </span>
          <span className="text-[13px] font-bold leading-tight">
            <span className="block text-white/45 text-[10.5px] uppercase tracking-wider">Trump</span>
            {s.trump ? SUIT_LABEL[s.trump] : 'Not set'}
          </span>
        </div>

        <div
          className="flex-1 h-11 px-3 rounded-full flex items-center justify-center gap-2 min-w-0"
          style={{ background: 'rgba(11,17,24,.6)', border: '1px solid rgba(255,255,255,.14)' }}
        >
          {s.declarerId ? (
            <>
              <span className="text-[13px] text-white/50 shrink-0">Contract</span>
              <span className="text-[17px] font-black tabular text-gold-300 shrink-0">{s.highestBid}</span>
              <span className="text-[13px] text-white/70 truncate">{g.declarerName}</span>
            </>
          ) : (
            <span className="text-[13.5px] font-semibold text-white/60">Auction in progress</span>
          )}
        </div>

        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Game menu"
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgba(11,17,24,.6)', border: '1px solid rgba(255,255,255,.14)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="5" r="1.9" fill="currentColor" />
            <circle cx="12" cy="12" r="1.9" fill="currentColor" />
            <circle cx="12" cy="19" r="1.9" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* ── partner cards, public once the declarer names them ─ */}
      {s.partnerSpecs.length > 0 && s.phase !== 'scoring' && (
        <div className="shrink-0 px-4 pb-2">
          <div
            className="rounded-2xl px-3 py-2 flex items-center gap-2.5"
            style={{
              background: g.iHoldPartnerCard ? 'rgba(16,185,129,.18)' : 'rgba(11,17,24,.55)',
              border: `1px solid ${g.iHoldPartnerCard ? 'rgba(52,211,153,.6)' : 'rgba(255,255,255,.14)'}`,
            }}
          >
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-white/50 shrink-0">
              {g.iHoldPartnerCard ? 'You hold' : 'Partner'}
            </span>
            <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
              {s.partnerSpecs.map((spec, i) => (
                <span
                  key={`${spec.rank}-${spec.suit}-${i}`}
                  className="px-2 h-7 rounded-full text-[13.5px] font-black flex items-center"
                  style={{ background: 'rgba(255,255,255,.14)', color: SUIT_TINT[spec.suit] }}
                >
                  {partnerLabel(spec)}
                </span>
              ))}
            </div>
            {g.iHoldPartnerCard && (
              <span className="text-[12px] font-bold text-mint-300 shrink-0">you are a partner</span>
            )}
          </div>
        </div>
      )}

      {/* ── table ───────────────────────────────────────── */}
      <Table
        seats={g.seats}
        total={s.config.playerCount}
        trick={s.currentTrick}
        trump={s.trump}
        playerById={g.playerById}
      />

      {/* ── my strip ────────────────────────────────────── */}
      {s.phase === 'playing' && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-3">
          <Avatar name={s.myPlayerName} index={s.myAvatar} size={38} />
          <div className="flex-1 min-w-0">
            <div className="text-[14.5px] font-bold truncate flex items-center gap-1.5">
              {s.myPlayerName || 'You'}
              {g.isDeclarer && <span className="text-[12px]">👑</span>}
              {s.revealedPartners.includes(s.myPlayerId) && (
                <span className="text-[12px] text-mint-300">★</span>
              )}
            </div>
            <div className="text-[12.5px] tabular flex items-center gap-1.5">
              <span className="text-white/50">
                {g.myTricks} trick{g.myTricks === 1 ? '' : 's'}
              </span>
              <span className="text-white/25">·</span>
              <span
                className="font-black"
                style={{ color: g.myScore.onDeclaringSide ? '#fcd34d' : '#6ee7b7' }}
              >
                {g.myScore.points}
                <span className="opacity-55"> / {g.myScore.outOf}</span>
              </span>
              {g.myScore.onDeclaringSide && g.fullyRevealed && (
                <span className="text-[11px] text-gold-300/70">team</span>
              )}
            </div>
          </div>
          <TurnPill
            myTurn={g.isMyTurn && !s.settling}
            turnName={g.turnName}
            leadSuit={s.currentTrick.leadSuit}
            settling={s.settling}
            winnerName={s.trickWinnerId ? g.nameOf(s.trickWinnerId) : ''}
          />
        </div>
      )}

      {/* ── hand ────────────────────────────────────────── */}
      {showFan && (
        <div className="shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}>
          <HandFan
            hand={s.myHand}
            trump={s.trump}
            leadSuit={s.settling ? null : s.currentTrick.leadSuit}
            myTurn={g.isMyTurn && !s.settling && !botHasMySeat}
            partnerSpecs={s.partnerSpecs}
            onPlay={playCard}
          />
        </div>
      )}

      {showStrip && s.myHand.length > 0 && <HandStrip hand={s.myHand} sorted={sortEnabled} trump={s.trump} />}

      {/* ── phase panels ────────────────────────────────── */}
      {s.phase === 'bidding' && (
        <BidPanel
          mode={s.config.mode}
          highestBid={s.highestBid}
          myTurn={g.isCurrentBidder}
          bidderName={g.bidderName}
          bids={s.bids}
          nameOf={g.nameOf}
          onBid={placeBid}
          onPass={passBid}
        />
      )}

      {s.phase === 'trump_selection' && (
        g.isDeclarer
          ? <TrumpPanel hand={s.declarerHand.length ? s.declarerHand : s.myHand} onSelect={selectTrump} />
          : <WaitingDock title="Choosing trump" subtitle={`${g.declarerName} is deciding the suit`} />
      )}

      {s.phase === 'partner_selection' && (
        g.isDeclarer
          ? (
            <PartnerPanel
              mode={s.config.mode}
              required={g.partnersNeeded}
              trump={s.trump}
              declarerHand={s.declarerHand.length ? s.declarerHand : s.myHand}
              onConfirm={selectPartners}
            />
          )
          : (
            <WaitingDock
              title="Partners being chosen"
              subtitle={`${g.declarerName} is naming ${g.partnersNeeded} partner card${g.partnersNeeded > 1 ? 's' : ''}`}
            />
          )
      )}

      {/* ── a bot is holding this seat ───────────────────── */}
      {botHasMySeat && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-[13.5px] font-bold z-40 whitespace-nowrap"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 166px)',
            background: 'rgba(11,17,24,.92)',
            color: '#fcd34d',
            border: '1px solid rgba(251,191,36,.5)',
          }}
        >
          A bot is finishing this round for you
        </div>
      )}

      {/* ── vote to end the game ─────────────────────────── */}
      <Sheet
        open={!!s.endVote}
        onClose={() => { /* a vote is answered, not dismissed */ }}
        dismissable={false}
        title="End this game?"
      >
        {s.endVote && (
          <div className="pb-2">
            <p className="text-[15px] text-white/70 text-center mb-1">
              <span className="font-bold text-white">
                {s.endVote.startedBy === s.myPlayerId ? 'You' : s.endVote.startedByName}
              </span>{' '}
              asked to stop the round. The table goes back to the lobby and the
              room code stays the same.
            </p>

            <div className="flex items-center justify-center gap-2 my-5">
              {s.endVote.eligible.map((id) => {
                const answer = s.endVote!.votes[id];
                const p = g.playerById(id);
                return (
                  <div key={id} className="flex flex-col items-center gap-1.5" style={{ width: 62 }}>
                    <Avatar name={p?.name ?? '?'} index={p?.avatar ?? 0} size={40} />
                    <span className="text-[11.5px] font-bold truncate w-full text-center">
                      {p?.name ?? 'Player'}
                    </span>
                    <span
                      className="text-[10.5px] font-black px-1.5 h-5 rounded-full flex items-center"
                      style={answer === true
                        ? { background: 'rgba(52,211,153,.25)', color: '#6ee7b7' }
                        : answer === false
                          ? { background: 'rgba(248,113,113,.22)', color: '#fca5a5' }
                          : { background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.45)' }}
                    >
                      {answer === true ? 'end' : answer === false ? 'play on' : '…'}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[13.5px] text-white/55 text-center mb-4 tabular">
              {s.endVote.agreed} of {s.endVote.needed} needed
            </p>

            {s.endVote.votes[s.myPlayerId] === undefined ? (
              <div className="flex gap-3">
                <Button variant="ghost" size="md" onClick={() => castEndVote(false)} full>
                  Keep playing
                </Button>
                <Button variant="danger" size="md" onClick={() => castEndVote(true)} full>
                  End it
                </Button>
              </div>
            ) : (
              <div className="h-[52px] rounded-[26px] surface flex items-center justify-center gap-3 text-[15px] font-bold text-white/60">
                <Spinner size={16} />
                Waiting for the others
              </div>
            )}
          </div>
        )}
      </Sheet>

      <DevOverlay />

      {/* ── menu ────────────────────────────────────────── */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Table">
        <div className="rounded-2xl surface p-4 mb-4">
          {!soloTable && <Row label="Room" value={s.roomCode ?? '—'} />}
          <Row label="Mode" value={s.config.mode === '500' ? 'Kadi Teri 500' : 'Classic'} />
          <Row label="Contract" value={s.declarerId ? `${s.highestBid} by ${g.declarerName}` : 'Not set'} />
          <Row label="Trump" value={s.trump ? SUIT_LABEL[s.trump] : 'Not set'} />
          <Row label="Partners revealed" value={String(s.revealedPartners.length)} />
          <Row label="Tricks played" value={String(s.completedTricks.length)} />
        </div>

        {s.phase === 'playing' && (
          <>
            <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mb-2">
              Points taken
            </p>
            {g.fullyRevealed && (
              <div
                className="rounded-2xl px-3.5 py-2.5 mb-2.5 flex items-center justify-between"
                style={{ background: 'rgba(245,158,11,.16)', border: '1px solid rgba(251,191,36,.4)' }}
              >
                <span className="text-[14.5px] font-bold text-gold-200">
                  Declaring side, all partners revealed
                </span>
                <span className="text-[16px] font-black tabular text-gold-300">
                  {g.teamPoints} / {s.highestBid}
                </span>
              </div>
            )}
            <div className="rounded-2xl surface overflow-hidden mb-4">
              {[...s.players]
                .sort((a, b) => (g.pointsTaken[b.id] ?? 0) - (g.pointsTaken[a.id] ?? 0))
                .map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3.5 py-2.5"
                    style={{ borderTop: i ? '1px solid rgba(255,255,255,.07)' : undefined }}
                  >
                    <Avatar name={p.name} index={p.avatar} isBot={p.isBot} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-bold truncate">
                        {p.name}
                        {p.id === s.myPlayerId && <span className="text-white/45 font-semibold"> (you)</span>}
                        {p.id === s.declarerId && <span className="text-gold-300"> 👑</span>}
                        {s.revealedPartners.includes(p.id) && <span className="text-mint-300"> ★</span>}
                      </div>
                    </div>
                    <div className="text-[16px] font-black tabular text-mint-300">
                      {g.pointsTaken[p.id] ?? 0}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}

        {s.lastTrick && (
          <>
            <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mb-2">
              Last trick · won by {g.nameOf(s.lastTrick.winnerId)}
            </p>
            <div className="flex gap-2 overflow-x-auto no-bar pb-3 mb-4" style={{ touchAction: 'pan-x' }}>
              {s.lastTrick.cards.map((c) => (
                <div key={c.id} className="shrink-0">
                  <PlayingCard rank={c.rank} suit={c.suit} width={46} />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-2.5">
          <Button variant="ghost" size="md" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
            Settings
          </Button>
          <Button
            variant="ghost"
            size="md"
            disabled={!!s.endVote || botHasMySeat}
            onClick={() => { setMenuOpen(false); proposeEndGame(); }}
          >
            {s.endVote ? 'A vote is already open' : 'End this game'}
          </Button>
          <p className="text-[12.5px] text-white/45 text-center -mt-1">
            Everyone still playing votes. More than half ends it and the table
            goes back to the lobby.
          </p>
          <Button variant="danger" size="md" onClick={() => { leaveRoom(); navigate('/'); }}>
            Leave table
          </Button>
          <p className="text-[12.5px] text-white/45 text-center -mt-1">
            A bot finishes the round in your seat.
          </p>
        </div>
      </Sheet>
    </Screen>
  );
}

function TurnPill({
  myTurn, turnName, leadSuit, settling, winnerName,
}: {
  myTurn: boolean;
  turnName: string;
  leadSuit: string | null;
  settling: boolean;
  winnerName: string;
}) {
  if (settling) {
    return (
      <div
        className="px-3.5 h-10 rounded-full flex items-center text-[13.5px] font-bold shrink-0 max-w-[168px]"
        style={{ background: 'rgba(52,211,153,.2)', color: '#6ee7b7' }}
      >
        <span className="truncate">{winnerName} takes it</span>
      </div>
    );
  }
  if (myTurn) {
    return (
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="px-3.5 h-10 rounded-full flex items-center text-[14px] font-black shrink-0"
        style={{ background: 'linear-gradient(180deg,#fbbf24,#d97706)', color: '#241503' }}
      >
        {leadSuit ? `Follow ${leadSuit}` : 'Your lead'}
      </motion.div>
    );
  }
  return (
    <div
      className="px-3.5 h-10 rounded-full flex items-center gap-2 text-[13.5px] font-semibold text-white/60 shrink-0 max-w-[150px]"
      style={{ background: 'rgba(255,255,255,.07)' }}
    >
      <Spinner size={14} />
      <span className="truncate">{turnName}</span>
    </div>
  );
}

/**
 * The hand while you cannot play it yet. Split across two rows so every
 * card is on screen at once, with no swiping to reach the far end.
 */
function HandStrip({ hand, sorted, trump }: { hand: Card[]; sorted: boolean; trump: Suit | null }) {
  const cards = sorted ? sortHand(hand, trump) : hand;
  if (!cards.length) return null;

  const perRow = Math.ceil(cards.length / 2);
  const rows = [cards.slice(0, perRow), cards.slice(perRow)].filter((r) => r.length);

  // Squeeze the overlap until the widest row fits the narrowest phone.
  const CARD_W = 54;
  const AVAILABLE = 342;
  const step = perRow > 1
    ? Math.min(CARD_W + 3, (AVAILABLE - CARD_W) / (perRow - 1))
    : 0;
  const cardH = Math.round(CARD_W * 1.42);

  return (
    <div className="shrink-0 px-4 pb-2 pt-1 flex flex-col items-center gap-1.5">
      {rows.map((row, r) => (
        <div
          key={r}
          className="relative"
          style={{ width: CARD_W + step * (row.length - 1), height: cardH }}
        >
          {row.map((c, i) => (
            <div key={c.id} className="absolute top-0" style={{ left: i * step, zIndex: i }}>
              <PlayingCard rank={c.rank} suit={c.suit} width={CARD_W} points="corner" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[14px] text-white/55">{label}</span>
      <span className="text-[14.5px] font-bold">{value}</span>
    </div>
  );
}
