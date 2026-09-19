// ============================================================
// Profile sheet — the name and avatar carried into every room
// ============================================================

import { useEffect, useState } from 'react';
import Sheet from '../ui/Sheet';
import { Avatar, Button } from '../ui';
import { useGameStore } from '../store/gameStore';
import { fallbackName, setAvatar, setPlayerName } from '../lib/identity';

export default function ProfileSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const storedName = useGameStore((s) => s.myPlayerName);
  const storedAvatar = useGameStore((s) => s.myAvatar);
  const setIdentity = useGameStore((s) => s.setIdentity);

  const [name, setName] = useState(storedName);
  const [avatar, setAvatarIndex] = useState(storedAvatar);

  useEffect(() => {
    if (open) { setName(storedName); setAvatarIndex(storedAvatar); }
  }, [open, storedName, storedAvatar]);

  const save = () => {
    const finalName = name.trim() || fallbackName();
    setPlayerName(finalName);
    setAvatar(avatar);
    setIdentity(finalName.slice(0, 16), avatar);
    onClose();
    onSaved?.();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Your player">
      <div className="flex justify-center mb-5">
        <Avatar name={name || '?'} index={avatar} size={84} />
      </div>

      <label className="block text-[13px] font-bold uppercase tracking-wider text-white/45 mb-2">
        Display name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 16))}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        placeholder="Enter your name"
        autoComplete="nickname"
        maxLength={16}
        className="w-full h-[56px] rounded-2xl px-4 text-[18px] font-bold outline-none surface focus:border-gold-400/60"
        style={{ caretColor: '#fbbf24' }}
      />

      <p className="text-[13px] font-bold uppercase tracking-wider text-white/45 mt-6 mb-3">
        Avatar colour
      </p>
      <div className="grid grid-cols-6 gap-3 mb-7">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={i}
            onClick={() => setAvatarIndex(i)}
            aria-label={`Avatar colour ${i + 1}`}
            className="flex items-center justify-center rounded-full transition-transform active:scale-90"
            style={{
              padding: 3,
              background: i === avatar ? 'rgba(251,191,36,.95)' : 'transparent',
            }}
          >
            <Avatar name={name || '?'} index={i} size={42} />
          </button>
        ))}
      </div>

      <Button onClick={save}>Save</Button>
    </Sheet>
  );
}
