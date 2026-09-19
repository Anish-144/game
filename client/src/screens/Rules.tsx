// ============================================================
// Rules
// ============================================================

import { useNavigate } from 'react-router-dom';
import { Screen, ScreenBody, TopBar } from '../ui';
import PlayingCard from '../components/game/PlayingCard';
import type { Rank, Suit } from '../types';

const POINTS: { rank: Rank; suit: Suit; value: number; note: string }[] = [
  { rank: '3', suit: 'spades', value: 30, note: 'The single biggest card in the game' },
  { rank: 'A', suit: 'hearts', value: 10, note: 'Every ace' },
  { rank: 'K', suit: 'spades', value: 10, note: 'Every king' },
  { rank: 'Q', suit: 'diamonds', value: 10, note: 'Every queen' },
  { rank: 'J', suit: 'clubs', value: 10, note: 'Every jack' },
  { rank: '10', suit: 'hearts', value: 10, note: 'Every ten' },
  { rank: '5', suit: 'clubs', value: 5, note: 'Every five' },
];

const SECTIONS = [
  {
    title: 'The goal',
    body: 'Win tricks that contain point cards. The declaring side has to reach the number they bid. Miss it and the opponents take the round.',
  },
  {
    title: 'The auction',
    body: 'Bidding opens at 125 and climbs in steps of 5, up to 250 in Classic or 500 in the 500 Edition. No number can be bid twice. Pass and you are out of the auction. The last player left takes the contract.',
  },
  {
    title: 'Trump',
    body: 'The declarer names a trump suit. Any trump card beats any card of another suit. Within a suit the order runs ace high down to two.',
  },
  {
    title: 'Partner cards',
    body: 'The declarer names one or more partner cards, and the table is told which cards they are. If one of them is in your hand, you are on the declaring side and you know it straight away. Everyone else only finds out who you are when you play that card.',
  },
  {
    title: 'Occurrence rules in the 500 Edition',
    body: 'Two decks means two copies of every card. The declarer says whether the first or the second time a card is played triggers the partnership. If the declarer already holds one copy, only the other copy counts.',
  },
  {
    title: 'Following suit',
    body: 'You must follow the led suit when you hold it. With none of that suit you may play anything, including a trump.',
  },
];

export default function Rules() {
  const navigate = useNavigate();

  return (
    <Screen background="ink">
      <TopBar title="How to play" onBack={() => navigate(-1)} />

      <ScreenBody className="px-5">
        <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mb-2.5">
          Point cards
        </p>
        <div className="rounded-2xl surface overflow-hidden mb-7">
          {POINTS.map((p, i) => (
            <div
              key={`${p.rank}-${p.suit}`}
              className="flex items-center gap-3.5 px-3.5 py-2.5"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,.07)' : undefined }}
            >
              <PlayingCard rank={p.rank} suit={p.suit} width={38} points="none" />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold">{p.note}</div>
              </div>
              <div className="text-[19px] font-black tabular text-gold-300">{p.value}</div>
            </div>
          ))}
        </div>

        {SECTIONS.map((sec) => (
          <section key={sec.title} className="mb-6">
            <h2 className="text-[17px] font-extrabold mb-1.5">{sec.title}</h2>
            <p className="text-[15px] leading-relaxed text-white/65">{sec.body}</p>
          </section>
        ))}

        <div className="h-8" />
      </ScreenBody>
    </Screen>
  );
}
