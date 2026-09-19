import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ChatFab } from './ChatFab';
import { ChatSheet } from './ChatSheet';

export function ChatContainer() {
  const roomCode = useGameStore((s) => s.roomCode);
  const [open, setOpen] = useState(false);

  if (!roomCode) return null;

  return (
    <>
      <ChatFab onClick={() => setOpen(true)} />
      <ChatSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
