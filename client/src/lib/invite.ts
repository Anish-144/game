// ============================================================
// Invite links, clipboard, and the native share sheet
// ============================================================

export function inviteLink(roomCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join/${roomCode}`;
}

/** What people read when the link is pasted into a chat. */
export function inviteText(roomCode: string): string {
  return `Join my Kadi Teri table. Room code ${roomCode}. ${inviteLink(roomCode)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function canShareFiles(): boolean {
  return canShare() && typeof navigator.canShare === 'function';
}

/** Native share sheet, resolving false when it is unavailable or dismissed. */
export async function shareInvite(roomCode: string): Promise<boolean> {
  if (!canShare()) return false;
  try {
    await navigator.share({
      title: 'Kadi Teri',
      text: `Join my Kadi Teri table. Room code ${roomCode}.`,
      url: inviteLink(roomCode),
    });
    return true;
  } catch {
    return false;
  }
}

/** Share the QR image itself, falling back to the link when files are blocked. */
export async function shareQr(roomCode: string, svgMarkup: string): Promise<boolean> {
  if (!canShareFiles()) return shareInvite(roomCode);
  try {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const file = new File([blob], `kadi-teri-${roomCode}.svg`, { type: 'image/svg+xml' });
    if (!navigator.canShare({ files: [file] })) return shareInvite(roomCode);
    await navigator.share({
      files: [file],
      title: 'Kadi Teri',
      text: `Scan to join room ${roomCode}.`,
    });
    return true;
  } catch {
    return false;
  }
}

/** Pull a 6-character room code out of a pasted link or raw code. */
export function parseRoomCode(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const fromLink = trimmed.match(/\/join\/([A-Za-z0-9]{4,8})/);
  const candidate = fromLink ? fromLink[1] : trimmed;
  const cleaned = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length === 6 ? cleaned : null;
}
