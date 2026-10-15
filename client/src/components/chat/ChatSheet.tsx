import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { sendChat } from '../../lib/socket';

export function ChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const chat = useGameStore((s) => s.chat);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const markChatRead = useGameStore((s) => s.markChatRead);

  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      markChatRead();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, chat.length, markChatRead]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendChat(text);
    setText('');
  };

  if (!open) return null;

  const CHAT_EMOJIS = ['😂', '🔥', '👏', '😎', '💀', '🎉', '❤️', '😱', '👍', '🤫', '👑', '🃏'];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] md:hidden" onClick={onClose} />
      <div
        className="fixed bottom-20 right-5 z-50 w-[340px] max-w-[calc(100vw-2.5rem)] h-[440px] max-h-[60vh] bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'fade-in 0.2s ease-out' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[17px]">💬</span>
            <h2 className="text-base font-bold text-white">Room Chat</h2>
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chat.length === 0 ? (
            <div className="flex h-full items-center justify-center text-white/30 text-sm italic">
              No messages yet. Say hi!
            </div>
          ) : (
            chat.map((msg) => {
              const isMe = msg.senderId === myPlayerId;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10.5px] font-semibold text-white/45 mb-0.5 px-1">{msg.senderName}</span>
                  <div
                    className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-[13.5px] leading-snug break-words ${
                      isMe
                        ? 'bg-amber-500/25 border border-amber-500/40 text-amber-100 rounded-br-sm'
                        : 'bg-white/10 border border-white/10 text-white rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick emoji row */}
        <div className="px-3 py-1.5 border-t border-white/10 flex items-center gap-1 overflow-x-auto no-scrollbar bg-black/30 shrink-0">
          {CHAT_EMOJIS.map((emo) => (
            <button
              key={emo}
              type="button"
              onClick={() => {
                sendChat(emo);
              }}
              className="text-[19px] p-1 hover:bg-white/15 active:scale-90 rounded-lg transition-transform shrink-0"
              title={`Send ${emo}`}
            >
              {emo}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-2.5 border-t border-white/10 flex items-center gap-2 bg-black/40">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            maxLength={300}
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-3.5 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="p-2.5 bg-amber-600 text-white rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-500 active:scale-95 transition-all shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
