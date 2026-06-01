import { create } from 'zustand'
import type { AnimationCommand, EmotionName, EnvironmentCommand, AvatarResponse } from '@/types/avatar'

interface AvatarState {
  // ── Visual state ────────────────────────────────────────────────────────────
  animation: AnimationCommand
  emotion: EmotionName
  environment: EnvironmentCommand | null
  isSpeaking: boolean
  isThinking: boolean

  // ── SDK mode speak callback ─────────────────────────────────────────────────
  /** Fourni par AvatarKitPlayer une fois connecté — null si non prêt */
  speak: ((pcm: ArrayBuffer) => Promise<void>) | null
  setSpeak: (fn: (pcm: ArrayBuffer) => Promise<void>) => void

  // ── Actions ─────────────────────────────────────────────────────────────────
  setAnimation: (cmd: AnimationCommand) => void
  setEmotion: (emotion: EmotionName) => void
  setEnvironment: (env: EnvironmentCommand | null) => void
  setSpeaking: (v: boolean) => void
  setThinking: (v: boolean) => void

  /** Apply a full AvatarResponse in one shot */
  applyAvatarResponse: (response: AvatarResponse) => void

  /** Return to idle neutral state */
  reset: () => void
}

const INITIAL_STATE = {
  animation: { name: 'idle' } as AnimationCommand,
  emotion: 'neutral' as EmotionName,
  environment: null,
  isSpeaking: false,
  isThinking: false,
  speak: null,
}

export const useAvatarStore = create<AvatarState>((set) => ({
  ...INITIAL_STATE,

  setSpeak: (fn) => set({ speak: fn }),
  setAnimation: (animation) => set({ animation }),
  setEmotion: (emotion) => set({ emotion }),
  setEnvironment: (environment) => set({ environment }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setThinking: (isThinking) => set({ isThinking }),

  applyAvatarResponse: (response) =>
    set({
      animation: response.animation,
      emotion: response.emotion,
      environment: response.environment ?? null,
      isSpeaking: true,
      isThinking: response.metadata?.thinking ?? false,
    }),

  reset: () => set(INITIAL_STATE),
}))
