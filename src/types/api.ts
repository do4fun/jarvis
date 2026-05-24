import type { AvatarResponse, ConversationTurn } from './avatar'

// ── Request ───────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string
  /** Conversation turns to include as context */
  history?: Pick<ConversationTurn, 'role' | 'content'>[]
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
