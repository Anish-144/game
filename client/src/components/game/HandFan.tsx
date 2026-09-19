// ============================================================
// Hand fan — the local player's cards
// Tap once to lift a card, tap again to play it.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import PlayingCard from './PlayingCard';
import type { Card, PartnerCardSpec, Suit } from '../../types';
import { isPartnerCard, playableIds, sortHand } from '../../lib/cards';
import { useSettings } from '../../store/settingsStore';
import { buzz } from '../../lib/haptics';
import { play as playSound } from '../../lib/audio';

const CARD_W = 64;
/** Keep the whole fan, rotation and point chips included, inside 390px. */
const MAX_SPREAD = 284;
const FAN_HEIGHT = 158;

export default function HandFan({
  hand,
  trump,
  leadSuit,
  myTurn,
  partnerSpecs,
  onPlay,
}: {
  hand: Card[];
  trump: Suit | null;
  leadSuit: Suit | null;
  myTurn: boolean;
  partnerSpecs: PartnerCardSpec[];
  onPlay: (cardId: string) => void;
}) {
  const sortEnabled = useSettings((s) => s.sortHand);
  const animate = useSettings((s) => s.cardAnimations);
  const [selected, setSelected] = useState<string | null>(null);
  const lastCount = useRef(hand.length);

  const cards = sortEnabled ? sortHand(hand, trump) : hand;
  const legal = playableIds(hand, myTurn ? leadSuit : null);

  // Drop the selection whenever the hand changes under us.
  useEffect(() => {
    if (hand.length !== lastCount.current) {
      lastCount.current = hand.length;
      setSelected(null);
    }
  }, [hand.length]);

  useEffect(() => {
    if (!myTurn) setSelected(null);
  }, [myTurn]);

  const perRow = Math.ceil(cards.length / 2);
  const rows = [cards.slice(0, perRow), cards.slice(perRow)].filter((r) => r.length);

  // Squeeze the overlap until the widest row fits the narrowest phone.
  const AVAILABLE = 350;
  const step = perRow > 1
    ? Math.min(CARD_W + 8, (AVAILABLE - CARD_W) / (perRow - 1))
    : 0;

  const tap = (card: Card) => {
    if (!myTurn) { buzz('warning'); return; }
    if (!legal.has(card.id)) { buzz('warning'); return; }
    if (selected === card.id) {
      playSound('play');
      buzz('medium');
      onPlay(card.id);
      setSelected(null);
    } else {
      playSound('tap');
      buzz('light');
      setSelected(card.id);
    }
  };

  const cardH = Math.round(CARD_W * 1.42);
  const totalH = rows.length > 1 ? cardH * 2 + 12 : cardH;

  return (
    <div className="relative w-full flex flex-col items-center gap-3 pt-2" style={{ height: totalH + 30 }}>
      {rows.map((row, r) => (
        <div
          key={r}
          className="relative"
          style={{ width: CARD_W + step * (row.length - 1), height: cardH }}
        >
          {row.map((card, i) => {
            const isSelected = selected === card.id;
            const playable = myTurn && legal.has(card.id);

            return (
              <motion.button
                key={card.id}
                layout={animate}
                initial={animate ? { y: 100, opacity: 0 } : false}
                animate={{
                  y: isSelected ? -24 : 0,
                  opacity: 1,
                  scale: isSelected ? 1.06 : 1,
                }}
                transition={{ type: 'spring', stiffness: 460, damping: 30, delay: animate ? i * 0.015 : 0 }}
                onClick={() => tap(card)}
                aria-label={`${card.rank} of ${card.suit}${playable ? '' : ', not playable'}`}
                className="absolute top-0 origin-bottom"
                style={{ left: i * step, zIndex: isSelected ? 60 : i }}
              >
                <PlayingCard
                  rank={card.rank}
                  suit={card.suit}
                  width={CARD_W}
                  selected={isSelected}
                  dimmed={myTurn && !playable}
                  points="above"
                  pointsAlign="left"
                  pointsLift={0}
                  partner={isPartnerCard(card, partnerSpecs)}
                />
              </motion.button>
            );
          })}
        </div>
      ))}

      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 top-[-10px] px-3.5 py-1.5 rounded-full text-[13px] font-bold"
          style={{ background: 'rgba(252,211,77,.95)', color: '#241503', zIndex: 70 }}
        >
          Tap again to play
        </motion.div>
      )}
    </div>
  );
}
