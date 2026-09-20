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

  return (
    <>
      <div
        className="fixed bottom-24 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] h-[450px] max-h-[60vh] bg-black/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'fade-in 0.2s ease-out' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Room Chat</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-white/50 hover:text-white rounded-full transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat.length === 0 ? (
            <div className="flex h-full items-center justify-center text-white/30 text-sm italic">
              No messages yet
            </div>
          ) : (
            chat.map((msg) => {
              const isMe = msg.senderId === myPlayerId;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-white/40 mb-1 ml-1 mr-1">{msg.senderName}</span>
                  <div
                    className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                      isMe
                        ? 'bg-amber-600/20 border border-amber-500/30 text-amber-50 rounded-br-sm'
                        : 'bg-white/5 border border-white/10 text-white rounded-bl-sm'
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

        <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex items-end gap-2 bg-black/20">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            maxLength={300}
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="p-3 bg-amber-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-500 transition-colors shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
