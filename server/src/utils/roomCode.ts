// Room code generator — unambiguous alphabet (no O/0, I/1)
import { roomExists } from '../rooms/room';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

/** Generate a code that is not already taken. */
export function generateRoomCode(): string {
  for (let i = 0; i < 50; i++) {
    const code = randomCode();
    if (!roomExists(code)) return code;
  }
  return randomCode();
}

export function normalizeCode(raw: string): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
