// ============================================================
// Haptics — no-op when unsupported or switched off
// ============================================================

import { currentSettings } from '../store/settingsStore';

type Pattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: 32,
  success: [12, 40, 18],
  warning: [24, 60, 24, 60, 24],
};

export function buzz(pattern: Pattern = 'light'): void {
  if (!currentSettings().vibration) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    /* unsupported */
  }
}
