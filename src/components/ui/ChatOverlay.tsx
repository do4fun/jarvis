'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useJarvis } from '@/hooks/useJarvis'
import { useConversationStore } from '@/store/useConversationStore'
import { useAvatarStore } from '@/store/useAvatarStore'
import SettingsPanel from './SettingsPanel'

// ── Response display ──────────────────────────────────────────────────────────

function ResponseDisplay({ text, thinking }: { text: string | null; thinking: boolean }) {
  return (
    <div className="mb-4 w-full max-w-lg px-4">
      <div className="min-h-20 rounded-2xl border border-white/10 bg-black/60 px-5 py-3 text-sm leading-relaxed shadow-lg backdrop-blur-md">
        {thinking && !text ? (
          <span className="flex items-center gap-2 text-white/40">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            En réflexion…
          </span>
        ) : text ? (
          <span className="text-white">{text}</span>
        ) : (
          <span className="text-white/20">La réponse apparaîtra ici…</span>
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
  characterName: string
}

function InputBar({ value, onChange, onSend, disabled, loading, characterName }: InputBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

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
    <div className="flex items-center gap-2 px-4" style={{ width: '100%', maxWidth: '32rem' }}>
      {/* Text input + send button */}
      <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 shadow-lg backdrop-blur-md">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Parlez à ${characterName}…`}
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
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Settings gear */}
      <SettingsPanel />
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

export default function ChatOverlay({ characterName = 'Jarvis' }: { characterName?: string }) {
  const [input, setInput] = useState('')

  const { sendMessage }                          = useJarvis()
  const { streamingText, isLoading, error, turns } = useConversationStore()
  const { isThinking }                           = useAvatarStore()

  const lastAssistantTurn = [...turns].reverse().find((t) => t.role === 'assistant')
  const lastAssistantText = lastAssistantTurn?.avatarResponse?.text ?? lastAssistantTurn?.content ?? null

  const bubbleText    = streamingText || (!isThinking ? lastAssistantText : null)
  const showThinking  = isThinking && !streamingText

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-8">
      <div className="pointer-events-auto w-full flex justify-center">
        <InputBar
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isLoading}
          loading={isLoading}
          characterName={characterName}
        />
      </div>

      {error && (
        <div className="pointer-events-auto">
          <ErrorBanner message={error} />
        </div>
      )}

      <ResponseDisplay text={bubbleText} thinking={showThinking} />
    </div>
  )
}
