// ============================================================
// Score — how the round landed
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, Button, Screen, ScreenBody, ScreenFooter, TopBar } from '../ui';
import PlayingCard from '../components/game/PlayingCard';
import { useGameStore } from '../store/gameStore';
import { useGame } from '../hooks/useGame';
import { leaveRoom, returnToLobby } from '../lib/socket';
import { SUIT_ACCENT, SUIT_GLYPH, SUIT_LABEL, totalPointsFor } from '../lib/cards';
import { play } from '../lib/audio';
import { buzz } from '../lib/haptics';
import confetti from 'canvas-confetti';

export default function Score() {
  const navigate = useNavigate();
  const score = useGameStore((s) => s.score);
  const config = useGameStore((s) => s.config);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const roomCode = useGameStore((s) => s.roomCode);
  const rejoining = useGameStore((s) => s.rejoining);
  const { playerById, nameOf } = useGame();

  const onDeclarerSide = !!score?.declarerTeam.playerIds.includes(myPlayerId);
  const iWon = !!score && (onDeclarerSide ? score.declarerTeam.won : score.opponentTeam.won);

  useEffect(() => {
    if (!roomCode && !rejoining) navigate('/', { replace: true });
  }, [roomCode, rejoining, navigate]);

  useEffect(() => {
    if (!score) return;
    play(iWon ? 'win' : 'lose');
    buzz(iWon ? 'success' : 'warning');

    if (iWon) {
      const duration = 2500;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors: ['#fbbf24', '#f59e0b', '#10b981', '#34d399', '#60a5fa']
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors: ['#fbbf24', '#f59e0b', '#10b981', '#34d399', '#60a5fa']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [score, iWon]);

  if (!score || !config) {
    return (
      <Screen background="ink">
        <TopBar title="Round over" onBack={() => { leaveRoom(); navigate('/'); }} />
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-[15px] text-white/55">No score to show for this round.</p>
        </div>
      </Screen>
    );
  }

  const total = totalPointsFor(config.mode);
  const declarerPct = Math.round((score.declarerTeam.points / total) * 100);

  return (
    <Screen background="ink">
      <TopBar
        title={iWon ? 'You won the round' : 'Round lost'}
        subtitle={`Contract ${score.bid} by ${nameOf(score.declarerId)}`}
        onBack={() => { leaveRoom(); navigate('/'); }}
      />

      <ScreenBody className="px-5">
        {/* headline */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="rounded-3xl p-5 mb-5 text-center"
          style={{
            background: iWon
              ? 'linear-gradient(160deg, rgba(16,185,129,.24), rgba(16,185,129,.06))'
              : 'linear-gradient(160deg, rgba(239,68,68,.22), rgba(239,68,68,.05))',
            border: `1.5px solid ${iWon ? 'rgba(52,211,153,.5)' : 'rgba(248,113,113,.45)'}`,
          }}
        >
          <div className="text-[13px] font-bold uppercase tracking-widest text-white/50 mb-1">
            {score.roundWinner === 'declarer' ? 'Declaring side made it' : 'Declaring side fell short'}
          </div>
          <div className="text-[46px] font-black leading-none tabular">
            {score.declarerTeam.points}
            <span className="text-white/35 text-[26px]"> / {score.bid}</span>
          </div>
          <div className="text-[14px] text-white/55 mt-1.5">
            Opponents took {score.opponentTeam.points} of {total}
          </div>

          <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden flex">
            <div
              style={{
                width: `${declarerPct}%`,
                background: 'linear-gradient(90deg,#fbbf24,#d97706)',
              }}
            />
            <div className="flex-1" style={{ background: 'rgba(96,165,250,.55)' }} />
          </div>
          <div className="flex justify-between text-[12px] mt-1.5 text-white/50">
            <span>Declaring side</span>
            <span>Opponents</span>
          </div>
        </motion.div>

        {/* trump + partner cards */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 rounded-2xl surface p-3.5 text-center">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white/45 mb-1">Trump</div>
            <div className="text-[30px] leading-none" style={{ color: SUIT_ACCENT[score.trump] }}>
              {SUIT_GLYPH[score.trump]}
            </div>
            <div className="text-[13px] text-white/60 mt-1">{SUIT_LABEL[score.trump]}</div>
          </div>
          <div className="flex-1 rounded-2xl surface p-3.5">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white/45 mb-2 text-center">
              Partner cards
            </div>
            <div className="flex gap-1.5 justify-center flex-wrap">
              {score.partnerCardsSelected.map((sp, i) => (
                <PlayingCard key={i} rank={sp.rank} suit={sp.suit} width={38} points="none" />
              ))}
            </div>
          </div>
        </div>

        {/* teams */}
        <TeamBlock
          title="Declaring side"
          accent="#fbbf24"
          ids={score.declarerTeam.playerIds}
          points={score.declarerTeam.points}
          won={score.declarerTeam.won}
          playerById={playerById}
          meId={myPlayerId}
        />
        <TeamBlock
          title="Opponents"
          accent="#60a5fa"
          ids={score.opponentTeam.playerIds}
          points={score.opponentTeam.points}
          won={score.opponentTeam.won}
          playerById={playerById}
          meId={myPlayerId}
        />

        {/* breakdown */}
        {score.pointBreakdown.length > 0 && (
          <>
            <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mt-6 mb-2.5">
              Point cards captured
            </p>
            <div className="rounded-2xl surface overflow-hidden mb-6">
              {score.pointBreakdown.map((item, i) => (
                <div
                  key={`${item.rank}-${item.suit}-${i}`}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                  style={{ borderTop: i ? '1px solid rgba(255,255,255,.07)' : undefined }}
                >
                  <PlayingCard rank={item.rank} suit={item.suit} width={34} points="none" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-bold">
                      {item.rank} {SUIT_GLYPH[item.suit]}
                      {item.count > 1 && <span className="text-white/45 font-semibold"> ×{item.count}</span>}
                    </div>
                    <div className="text-[12.5px] text-white/50 truncate">
                      taken by {item.winnerName ?? nameOf(item.winnerId)}
                    </div>
                  </div>
                  <div className="text-[16px] font-black tabular text-gold-300">{item.total}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="h-4" />
      </ScreenBody>

      <ScreenFooter>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => { leaveRoom(); navigate('/'); }}>Home</Button>
          {config.hostId === myPlayerId ? (
            <Button className="flex-1" onClick={() => returnToLobby()}>Rematch</Button>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[13px] font-bold text-white/40 uppercase tracking-wide">
              Waiting for host...
            </div>
          )}
        </div>
      </ScreenFooter>
    </Screen>
  );
}

function TeamBlock({
  title, accent, ids, points, won, playerById, meId,
}: {
  title: string;
  accent: string;
  ids: string[];
  points: number;
  won: boolean;
  playerById: (id: string) => { name: string; avatar: number; isBot: boolean } | undefined;
  meId: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 mb-3"
      style={{ background: 'rgba(255,255,255,.055)', border: `1.5px solid ${won ? accent : 'rgba(255,255,255,.1)'}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[15px] font-extrabold" style={{ color: accent }}>{title}</span>
        <span className="text-[20px] font-black tabular">{points}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {ids.map((id) => {
          const p = playerById(id);
          return (
            <div key={id} className="flex items-center gap-2 pr-3 pl-1 h-10 rounded-full bg-white/7">
              <Avatar name={p?.name ?? '?'} index={p?.avatar ?? 0} isBot={p?.isBot} size={32} />
              <span className="text-[13.5px] font-bold max-w-[110px] truncate">
                {p?.name ?? 'Player'}{id === meId ? ' (you)' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
