import type { AvatarResponse, ConversationTurn } from './avatar'

// ── Request ───────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string
  /** Conversation turns to include as context */
  history?: Pick<ConversationTurn, 'role' | 'content'>[]
  /**
   * Session AvatarKit active — quand fourni, le handler /api/chat streame
   * chaque token texte directement vers l'API TTS d'AvatarKit (server-to-server).
   * Optimisation latence : le texte arrive à l'avatar sans round-trip client.
   */
  avatarSessionId?: string
  /** LiveKit room name — defaults to 'jarvis-room' on the server */
  room?: string
}

// ── SSE Events streamed back to the client ────────────────────────────────────

/** Incremental text delta — rendered in the UI word-by-word */
export interface SSETextDelta {
  type: 'text_delta'
  content: string
}

/** Full AvatarResponse emitted once Claude finishes the tool call */
export interface SSEAvatarComplete {
  type: 'avatar_complete'
  response: AvatarResponse
}

/** Non-recoverable error during generation */
export interface SSEError {
  type: 'error'
  message: string
}

/** Stream is finished — safe to close the EventSource */
export interface SSEDone {
  type: 'done'
}

export type SSEEvent = SSETextDelta | SSEAvatarComplete | SSEError | SSEDone
