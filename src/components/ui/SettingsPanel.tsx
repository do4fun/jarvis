'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, Volume2, VolumeX } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'

// ── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleProps {
  enabled: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  icon?: React.ReactNode
}

function Toggle({ enabled, onChange, label, description, icon }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-white/40">{icon}</span>}
        <div>
          <p className="text-sm text-white/80">{label}</p>
          {description && (
            <p className="text-xs text-white/35">{description}</p>
          )}
        </div>
      </div>

      {/* Toggle pill */}
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none
          ${enabled ? 'bg-indigo-500' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
            ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}

// ── SettingsPanel ─────────────────────────────────────────────────────────────

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const panelRef        = useRef<HTMLDivElement>(null)

  const { ttsEnabled, setTtsEnabled } = useSettingsStore()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={panelRef} className="relative">
      {/* Gear button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Préférences"
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors
          ${open
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-white/10 bg-black/40 text-white/40 hover:text-white/80'
          } backdrop-blur-md`}
      >
        <Settings className="h-3.5 w-3.5" />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-10 right-0 w-64 rounded-2xl border border-white/10 bg-black/80 px-4 py-3 shadow-xl backdrop-blur-md">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-white/30">
            Préférences
          </p>

          <div className="divide-y divide-white/5">
            <Toggle
              label="Voix ElevenLabs"
              description="Synthèse vocale des réponses"
              enabled={ttsEnabled}
              onChange={setTtsEnabled}
              icon={ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
      )}
    </div>
  )
}
