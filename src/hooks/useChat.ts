'use client'

import { useCallback } from 'react'
import { useAvatarStore } from '@/store/useAvatarStore'
import { useConversationStore } from '@/store/useConversationStore'
import type { ChatRequest, SSEEvent } from '@/types/api'
import type { AvatarResponse, ConversationTurn } from '@/types/avatar'

// ── SSE reader ────────────────────────────────────────────────────────────────

async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data: ')) continue
        try {
          yield JSON.parse(line.slice(6)) as SSEEvent
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseChatOptions {
  /**
   * Called once when the LLM has finished generating the full AvatarResponse.
   * Fire-and-forget — errors are caught internally so they don't block the SSE loop.
   */
  onAvatarComplete?: (response: AvatarResponse) => Promise<void>
}

// Options supplémentaires passées par appel (avatarSessionId pour WebRTC)
interface SendMessageOptions {
  /** Session AvatarKit — forwarded au backend pour le streaming TTS direct */
  avatarSessionId?: string
}

export function useChat({ onAvatarComplete }: UseChatOptions = {}) {
  // setSpeaking is intentionally NOT managed here — useAudio owns that lifecycle
  const { applyAvatarResponse, setThinking } = useAvatarStore()
  const { turns, addTurn, appendStreamingText, commitStreamingText, setLoading, setError } =
    useConversationStore()

  const sendMessage = useCallback(
    async (message: string, opts: SendMessageOptions = {}) => {
      const trimmed = message.trim()
      if (!trimmed) return

      const userTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      }
      addTurn(userTurn)
      setLoading(true)
      setError(null)
      setThinking(true)

      const body: ChatRequest = {
        message:         trimmed,
        history:         turns.map((t) => ({ role: t.role, content: t.content })),
        avatarSessionId: opts.avatarSessionId,
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`)

        setThinking(false)

        for await (const event of readSSE(res.body)) {
          switch (event.type) {
            case 'text_delta':
              appendStreamingText(event.content)
              break

            case 'avatar_complete':
              applyAvatarResponse(event.response)
              commitStreamingText(event.response)
              // Start TTS asynchronously — don't await so SSE loop can finish cleanly
              onAvatarComplete?.(event.response).catch(console.error)
              break

            case 'error':
              setError(event.message)
              break

            case 'done':
              break
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setThinking(false)
        // isSpeaking is NOT reset here — useAudio resets it when audio ends
      }
    },
    [
      turns,
      addTurn,
      appendStreamingText,
      commitStreamingText,
      applyAvatarResponse,
      setLoading,
      setError,
      setThinking,
      onAvatarComplete,
    ],
  )

  return { sendMessage }
}
