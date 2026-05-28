// ─────────────────────────────────────────────────────────────────────────────
// useAvatarKitStore — État Zustand pour la session WebRTC AvatarKit
//
// Centralise l'état de connexion, le MediaStream reçu via WebRTC,
// et le sessionId nécessaire pour les appels API backend.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type { AvatarKitConnectionStatus, AvatarKitStoreState } from '@/types/avatarkit'

interface AvatarKitStore extends AvatarKitStoreState {
  // ── Actions ──────────────────────────────────────────────────────────────────
  setStatus:      (status: AvatarKitConnectionStatus) => void
  setSessionId:   (sessionId: string | null) => void
  setMediaStream: (stream: MediaStream | null) => void
  setError:       (error: string | null) => void

  /** Réinitialisation complète (déconnexion ou fermeture de session) */
  reset: () => void
}

const INITIAL_STATE: AvatarKitStoreState = {
  status:      'idle',
  sessionId:   null,
  mediaStream: null,
  error:       null,
}

export const useAvatarKitStore = create<AvatarKitStore>((set) => ({
  ...INITIAL_STATE,

  setStatus:      (status)      => set({ status }),
  setSessionId:   (sessionId)   => set({ sessionId }),
  setMediaStream: (mediaStream) => set({ mediaStream }),
  setError:       (error)       => set({ error }),

  reset: () => set(INITIAL_STATE),
}))
