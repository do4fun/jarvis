'use client'

// ─────────────────────────────────────────────────────────────────────────────
// AvatarKitPlayer — Rendu canvas WebGL + contrôles microphone
//
// Utilise le SDK officiel @spatialwalk/avatarkit + @spatialwalk/avatarkit-rtc.
// L'avatar est rendu côté serveur SpatialReal et reçu via WebRTC (LiveKit).
// ─────────────────────────────────────────────────────────────────────────────

import { Mic, MicOff, RefreshCw } from 'lucide-react'
import { useSpatialRealAvatar } from '@/hooks/useSpatialRealAvatar'

interface AvatarKitPlayerProps {
  appId:     string
  avatarId:  string
  className?: string
}

export default function AvatarKitPlayer({ appId, avatarId, className = '' }: AvatarKitPlayerProps) {
  const {
    status,
    error,
    downloadProgress,
    isPublishingMic,
    startPublishingMic,
    stopPublishingMic,
    reconnect,
    containerRef,
  } = useSpatialRealAvatar({ appId, avatarId })

  return (
    <div className={`relative overflow-hidden ${className}`}>

      {/* ── Canvas WebGL — rempli par AvatarView ───────────────────────────── */}
      <div
        ref={containerRef}
        className={`h-full w-full transition-opacity duration-500 ${
          status === 'connected' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── États de chargement / connexion ───────────────────────────────── */}
      {(status === 'idle' || status === 'initializing' || status === 'loading' || status === 'connecting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f0f1a]">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
            <div className="absolute inset-4 rounded-full bg-blue-600/40" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium tracking-widest uppercase text-blue-300/80">
              {status === 'initializing' && 'Initialisation SDK…'}
              {status === 'loading'      && `Chargement avatar… ${downloadProgress}%`}
              {status === 'connecting'   && 'Connexion LiveKit…'}
              {status === 'idle'         && 'En attente'}
            </p>
            {status === 'loading' && downloadProgress > 0 && (
              <div className="h-1 w-40 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-blue-400 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Erreur ────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f1a]">
          <div className="h-12 w-12 rounded-full bg-red-900/40 flex items-center justify-center">
            <span className="text-2xl text-red-400">⚠</span>
          </div>
          <p className="text-sm text-red-400 text-center px-6 max-w-xs">
            {error ?? 'Erreur de connexion'}
          </p>
          <button
            onClick={() => void reconnect()}
            className="flex items-center gap-2 rounded-lg border border-blue-500/30 px-4 py-2 text-xs text-blue-300 transition-colors hover:bg-blue-500/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reconnecter
          </button>
        </div>
      )}

      {/* ── Bouton microphone (affiché quand connecté) ─────────────────────── */}
      {status === 'connected' && (
        <button
          onClick={() => void (isPublishingMic ? stopPublishingMic() : startPublishingMic())}
          className={`absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
            isPublishingMic
              ? 'border-blue-400/60 bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/20'
              : 'border-white/20 bg-black/40 text-white/50 hover:text-white/80'
          }`}
          aria-label={isPublishingMic ? 'Couper le microphone' : 'Activer le microphone'}
        >
          {isPublishingMic
            ? <Mic    className="h-4 w-4" />
            : <MicOff className="h-4 w-4" />
          }
        </button>
      )}
    </div>
  )
}
