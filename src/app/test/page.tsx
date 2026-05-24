'use client'

import { useState } from 'react'
import type { SSEEvent } from '@/types/api'
import type { AvatarResponse } from '@/types/avatar'

// ── Badges ────────────────────────────────────────────────────────────────────

const EMOTION_COLOR: Record<string, string> = {
  neutral:   'bg-indigo-500/20 text-indigo-300',
  happy:     'bg-green-500/20  text-green-300',
  sad:       'bg-blue-500/20   text-blue-300',
  angry:     'bg-red-500/20    text-red-300',
  surprised: 'bg-amber-500/20  text-amber-300',
  curious:   'bg-violet-500/20 text-violet-300',
  excited:   'bg-orange-500/20 text-orange-300',
  confused:  'bg-slate-500/20  text-slate-300',
}

function Badge({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-white/30">{label}</span>
      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${colorClass ?? 'bg-white/10 text-white/70'}`}>
        {value}
      </span>
    </div>
  )
}

// ── AvatarResponse panel ──────────────────────────────────────────────────────

function ResponsePanel({ response }: { response: AvatarResponse }) {
  const [raw, setRaw] = useState(false)

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="mb-3 text-[11px] uppercase tracking-widest text-white/30">AvatarResponse</p>

      {/* Badges */}
      <div className="mb-4 flex flex-wrap gap-4">
        <Badge label="Animation" value={response.animation.name} />
        <Badge
          label="Émotion"
          value={response.emotion}
          colorClass={EMOTION_COLOR[response.emotion] ?? 'bg-white/10 text-white/70'}
        />
        {response.animation.intensity !== undefined && (
          <Badge label="Intensité" value={String(response.animation.intensity)} />
        )}
        {response.environment?.preset && (
          <Badge label="Environnement" value={response.environment.preset} />
        )}
        {response.metadata?.language && (
          <Badge label="Langue" value={response.metadata.language} />
        )}
      </div>

      {/* Text */}
      <div className="mb-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-white/30">text (→ TTS)</p>
        <p className="text-sm text-white/80">{response.text}</p>
      </div>

      {/* Raw JSON toggle */}
      <button
        onClick={() => setRaw(v => !v)}
        className="text-[11px] text-white/30 underline underline-offset-2 hover:text-white/60"
      >
        {raw ? 'Masquer' : 'Voir'} le JSON brut
      </button>
      {raw && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[11px] text-green-300/80">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [prompt,   setPrompt]   = useState('')
  const [text,     setText]     = useState('')
  const [response, setResponse] = useState<AvatarResponse | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSend = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setText('')
    setResponse(null)
    setError(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          const event: SSEEvent = JSON.parse(line.slice(6))

          if (event.type === 'text_delta')     setText(t => t + event.content)
          if (event.type === 'avatar_complete') setResponse(event.response)
          if (event.type === 'error')           setError(event.message)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] p-8 text-white">
      <h1 className="mb-1 text-xl font-semibold tracking-wide text-white/80">
        Test — Anthropic API
      </h1>
      <p className="mb-8 text-sm text-white/30">
        Les appels sont journalisés dans <code className="text-white/50">logs/app.log</code>
      </p>

      {/* Prompt */}
      <label className="mb-1 block text-sm text-white/50">Prompt</label>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
        placeholder="Entrez votre message… (Ctrl+Enter pour envoyer)"
        rows={4}
        className="mb-4 w-full max-w-2xl rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-white/30"
      />

      <button
        onClick={handleSend}
        disabled={loading || !prompt.trim()}
        className="mb-8 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'En cours…' : 'Envoyer'}
      </button>

      {/* Streaming text */}
      {(text || loading) && (
        <div className="mb-2 max-w-2xl">
          <label className="mb-1 block text-sm text-white/50">Réponse (streaming)</label>
          <div className="min-h-15 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/90">
            {text || <span className="animate-pulse text-white/30">En attente…</span>}
          </div>
        </div>
      )}

      {/* AvatarResponse details */}
      {response && (
        <div className="max-w-2xl">
          <ResponsePanel response={response} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 max-w-2xl rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </main>
  )
}
