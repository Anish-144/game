// ============================================================
// Settings
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Screen, ScreenBody, Segment, Switch, TopBar } from '../ui';
import ProfileSheet from '../components/ProfileSheet';
import { applyTheme, useSettings, type Theme } from '../store/settingsStore';
import { useGameStore } from '../store/gameStore';
import { play, syncMusic, unlockAudio } from '../lib/audio';
import { buzz } from '../lib/haptics';

export default function Settings() {
  const navigate = useNavigate();
  const s = useSettings();
  const name = useGameStore((st) => st.myPlayerName);
  const avatar = useGameStore((st) => st.myAvatar);
  const [profileOpen, setProfileOpen] = useState(false);

  const isDev = import.meta.env.DEV;

  return (
    <Screen background="ink">
      <TopBar title="Settings" onBack={() => navigate(-1)} />

      <ScreenBody className="px-5">
        {/* profile */}
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full rounded-2xl surface p-4 flex items-center gap-4 mb-6 active:scale-[.99] transition-transform"
        >
          <Avatar name={name || '?'} index={avatar} size={54} />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[17px] font-bold truncate">{name || 'Set your name'}</div>
            <div className="text-[13px] text-white/50">Tap to change name or colour</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* audio */}
        <Group title="Audio">
          <Switch
            label="Sound effects"
            hint="Card taps, bids, and trick results"
            checked={s.sound}
            onChange={(v) => { s.set('sound', v); if (v) { unlockAudio(); play('tap'); } }}
          />
          <Divider />
          <Switch
            label="Music"
            hint="Quiet ambient pad during play"
            checked={s.music}
            onChange={(v) => { s.set('music', v); unlockAudio(); syncMusic(); }}
          />
        </Group>

        {/* feel */}
        <Group title="Feel">
          <Switch
            label="Vibration"
            hint="Haptic feedback on taps and reveals"
            checked={s.vibration}
            onChange={(v) => { s.set('vibration', v); if (v) buzz('medium'); }}
          />
          <Divider />
          <Switch
            label="Card animations"
            hint="Deal, lift, and trick motion"
            checked={s.cardAnimations}
            onChange={(v) => s.set('cardAnimations', v)}
          />
          <Divider />
          <Switch
            label="Sort my hand"
            hint="Group by suit with trump first"
            checked={s.sortHand}
            onChange={(v) => s.set('sortHand', v)}
          />
        </Group>

        {/* theme */}
        <Group title="Table theme">
          <div className="pt-1 pb-2">
            <Segment<Theme>
              value={s.theme}
              onChange={(v) => { s.set('theme', v); applyTheme(v); }}
              options={[
                { value: 'emerald', label: 'Emerald' },
                { value: 'midnight', label: 'Midnight' },
                { value: 'crimson', label: 'Crimson' },
              ]}
            />
            <div className="flex gap-2 mt-3 pb-1">
              {THEME_SWATCHES.map((t) => (
                <div key={t.label} className="flex-1 h-9 rounded-xl" style={{ background: t.swatch }} />
              ))}
            </div>
          </div>
        </Group>

        {isDev && (
          <Group title="Developer">
            <Switch
              label="Developer preview"
              hint="Extra state readouts while testing. Never shown in a release build."
              checked={s.developerPreview}
              onChange={(v) => s.set('developerPreview', v)}
            />
          </Group>
        )}

        <div className="mt-6 mb-10">
          <Button variant="ghost" size="md" onClick={() => navigate('/rules')}>
            How to play
          </Button>
          <p className="text-[12.5px] text-white/35 text-center mt-5">Kadi Teri · version 3.0</p>
        </div>
      </ScreenBody>

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </Screen>
  );
}

const THEME_SWATCHES = [
  { label: 'Emerald', swatch: 'linear-gradient(180deg,#0b7a5c,#022c22)' },
  { label: 'Midnight', swatch: 'linear-gradient(180deg,#274060,#0b1118)' },
  { label: 'Crimson', swatch: 'linear-gradient(180deg,#7a2231,#24070e)' },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mb-2">{title}</p>
      <div className="rounded-2xl surface px-4">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-white/8" />;
}
