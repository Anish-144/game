// ============================================================
// Settings — persisted to localStorage
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'emerald' | 'midnight' | 'crimson';

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  theme: Theme;
  cardAnimations: boolean;
  developerPreview: boolean;
  sortHand: boolean;
}

interface SettingsStore extends Settings {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  toggle(key: 'sound' | 'music' | 'vibration' | 'cardAnimations' | 'developerPreview' | 'sortHand'): void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      sound: true,
      music: false,
      vibration: true,
      theme: 'emerald',
      cardAnimations: true,
      developerPreview: false,
      sortHand: true,
      set: (key, value) => set({ [key]: value } as never),
      toggle: (key) => set((s) => ({ [key]: !s[key] } as never)),
    }),
    { name: 'kadi.settings', storage: createJSONStorage(() => localStorage) },
  ),
);

/** Read settings outside React (audio and haptics helpers). */
export function currentSettings(): Settings {
  return useSettings.getState();
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'emerald') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
