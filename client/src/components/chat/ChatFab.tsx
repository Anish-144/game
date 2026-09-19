import { useState, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

export function ChatFab({ onClick }: { onClick: () => void }) {
  const unread = useGameStore((s) => s.unreadChat);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPosition = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    moved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPosition.current = { ...position };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      moved.current = true;
    }
    
    setPosition({
      x: initialPosition.current.x + dx,
      y: initialPosition.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    onClick();
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className="fixed top-4 right-4 z-30 p-3 bg-neutral-800/80 backdrop-blur-md text-white rounded-full shadow-lg border border-white/10 hover:bg-neutral-700/80 transition-colors touch-none select-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      aria-label="Open chat"
    >
      <div className="relative flex items-center justify-center w-6 h-6 pointer-events-none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full opacity-80">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-neutral-900 shadow-sm animate-pulse" />
        )}
      </div>
    </button>
  );
}
