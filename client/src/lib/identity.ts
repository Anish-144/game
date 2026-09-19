// ============================================================
// Local identity — one stable player id per device
// ============================================================

const ID_KEY = 'kadi.playerId';
const NAME_KEY = 'kadi.playerName';
const AVATAR_KEY = 'kadi.avatar';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export function getPlayerId(): string {
  let id = read(ID_KEY);
  if (!id) { id = uuid(); write(ID_KEY, id); }
  return id;
}

export function getPlayerName(): string {
  return read(NAME_KEY) ?? '';
}

export function setPlayerName(name: string): void {
  write(NAME_KEY, name.trim().slice(0, 16));
}

export function getAvatar(): number {
  const raw = read(AVATAR_KEY);
  const n = raw === null ? Math.floor(Math.random() * 12) : Number(raw);
  const safe = Number.isFinite(n) ? ((n % 12) + 12) % 12 : 0;
  if (raw === null) write(AVATAR_KEY, String(safe));
  return safe;
}

export function setAvatar(index: number): void {
  write(AVATAR_KEY, String(((index % 12) + 12) % 12));
}

/** A friendly fallback so nobody is ever seated as "undefined". */
export function fallbackName(): string {
  const names = ['Player', 'Ace', 'Raja', 'Trump', 'Jack', 'Queenie', 'Kadi'];
  return `${names[Math.floor(Math.random() * names.length)]}${Math.floor(Math.random() * 90) + 10}`;
}

// ─── last room ────────────────────────────────────────────────────────────────
// Remembered so a refresh or a dropped connection returns to the same seat.

const ROOM_KEY = 'kadi.room';

export function rememberRoom(code: string): void {
  try { sessionStorage.setItem(ROOM_KEY, code); } catch { /* private mode */ }
}

export function forgetRoom(): void {
  try { sessionStorage.removeItem(ROOM_KEY); } catch { /* private mode */ }
}

export function lastRoom(): string | null {
  try { return sessionStorage.getItem(ROOM_KEY); } catch { return null; }
}
