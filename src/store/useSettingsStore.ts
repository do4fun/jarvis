import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // ── Préférences ──────────────────────────────────────────────────────────────
  ttsEnabled: boolean

  // ── Actions ──────────────────────────────────────────────────────────────────
  setTtsEnabled: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ttsEnabled: true,
      setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
    }),
    {
      name: 'jarvis-settings', // clé localStorage
    },
  ),
)
