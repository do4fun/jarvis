import { create } from 'zustand'
import type { ConversationTurn, AvatarResponse } from '@/types/avatar'

interface ConversationState {
  // ── Data ────────────────────────────────────────────────────────────────────
  turns: ConversationTurn[]
  /** Text accumulated during an active SSE stream (not yet committed as a turn) */
  streamingText: string
  isLoading: boolean
  error: string | null

  // ── Actions ─────────────────────────────────────────────────────────────────
  addTurn: (turn: ConversationTurn) => void

  /** Append a chunk received from a text_delta SSE event */
  appendStreamingText: (chunk: string) => void

  /**
   * Finalise the streaming text as an assistant turn.
   * Called when avatar_complete is received.
   */
  commitStreamingText: (avatarResponse: AvatarResponse) => void

  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  clearHistory: () => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  turns: [],
  streamingText: '',
  isLoading: false,
  error: null,

  addTurn: (turn) =>
    set((state) => ({ turns: [...state.turns, turn] })),

  appendStreamingText: (chunk) =>
    set((state) => ({ streamingText: state.streamingText + chunk })),

  commitStreamingText: (avatarResponse) => {
    const { streamingText } = get()
    const turn: ConversationTurn = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: streamingText,
      timestamp: Date.now(),
      avatarResponse,
    }
    set((state) => ({
      turns: [...state.turns, turn],
      streamingText: '',
    }))
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearHistory: () => set({ turns: [], streamingText: '', error: null }),
}))
