'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useJarvis } from '@/hooks/useJarvis'
import { useConversationStore } from '@/store/useConversationStore'
import { useAvatarStore } from '@/store/useAvatarStore'

// ── Response bubble ───────────────────────────────────────────────────────────

function ResponseBubble({ text, thinking }: { text: string | null; thinking: boolean }) {
  const visible = thinking || !!text
  if (!visible) return null

  return (
    <div className="mb-5 w-full max-w-lg px-4">
      <div className="rounded-2xl border border-white/10 bg-black/60 px-5 py-3 text-sm leading-relaxed text-white shadow-lg backdrop-blur-md">
        {thinking && !text ? (
          <span className="flex items-center gap-2 text-white/40">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            En réflexion…
          </span>
        ) : (
          <span>{text}</span>
        )}
      </div>
    </div>
  )
}

// ── Input bar ─────────────────────────────────────────────────────────────────

interface InputBarProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
  loading: boolean
}

function InputBar({ value, onChange, onSend, disabled, loading }: InputBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep focus after each message
  useEffect(() => {
    if (!loading) inputRef.current?.focus()
  }, [loading])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="w-full max-w-lg px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 shadow-lg backdrop-blur-md">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Parlez à Jarvis…"
          disabled={disabled}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-40"
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 text-white/50 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-25"
          aria-label="Envoyer"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-3 w-full max-w-lg px-4">
      <p className="text-center font-mono text-xs text-red-400">{message}</p>
    </div>
  )
}

// ── ChatOverlay ───────────────────────────────────────────────────────────────

export default function ChatOverlay() {
  const [input, setInput] = useState('')

  const { sendMessage } = useJarvis()
  const { streamingText, isLoading, error, turns } = useConversationStore()
  const { isThinking } = useAvatarStore()

  // Last completed assistant message
  const lastAssistantText =
    [...turns].reverse().find((t) => t.role === 'assistant')?.content ?? null

  // What appears in the bubble:
  //   streaming in progress → live text
  //   thinking (no text yet) → null (bubble shows spinner)
  //   idle → last completed response
  const bubbleText = streamingText || (!isThinking ? lastAssistantText : null)
  const showThinking = isThinking && !streamingText

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  return (
    // pointer-events-none on the container so the 3D canvas stays interactive
    // pointer-events-auto re-enabled on each interactive child
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-8">
      <ResponseBubble text={bubbleText} thinking={showThinking} />

      {error && (
        <div className="pointer-events-auto">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="pointer-events-auto w-full flex justify-center">
        <InputBar
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isLoading}
          loading={isLoading}
        />
      </div>
    </div>
  )
}
