'use client'

// ─────────────────────────────────────────────────────────────────────────────
// AvatarKitPlayer — Lecteur vidéo WebRTC ultra-léger
//
// Ce composant remplace le canvas Three.js / R3F par un simple élément <video>
// recevant le flux MediaStream depuis AvatarKit via WebRTC.
//
// Optimisations latence :
//   • autoPlay        : aucun clic utilisateur requis pour démarrer la vidéo
//   • playsInline     : indispensable sur iOS pour éviter le fullscreen forcé
//   • muted           : contourne la politique autoplay des navigateurs
//                       (l'audio est géré séparément via WebRTC audio track)
//   • disablePictureInPicture : réduit l'overhead de rendu sur mobile
//   • Sans buffering  : le MediaStream WebRTC est en direct (pas de source src)
//
// Rendu côté serveur AvatarKit (SpatialReal) :
//   L'avatar 3D est rendu sur les serveurs de SpatialReal et transmis en H.264
//   via DTLS/SRTP → zéro charge GPU côté client.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { useAvatarKitStore } from '@/store/useAvatarKitStore'
import { useAvatarKit } from '@/hooks/useAvatarKit'
import type { AvatarKitSessionConfig } from '@/types/avatarkit'

interface AvatarKitPlayerProps {
  config: AvatarKitSessionConfig
  className?: string
}

export default function AvatarKitPlayer({ config, className = '' }: AvatarKitPlayerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const { mediaStream, status, error } = useAvatarKitStore()
  const { connect } = useAvatarKit()

  // Initialiser la session WebRTC au montage du composant
  useEffect(() => {
    void connect(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionnellement vide — connexion unique au montage

  // Attacher le MediaStream WebRTC au <video> dès réception
  useEffect(() => {
    if (!videoRef.current || !mediaStream) return

    // Optimisation : assigner srcObject directement (pas de Blob URL)
    // → zéro latence de création d'URL, pas de buffering HTTP
    videoRef.current.srcObject = mediaStream

    videoRef.current.play().catch((err) => {
      console.error('[AvatarKitPlayer] play() error:', err)
    })
  }, [mediaStream])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* ── Flux vidéo WebRTC ─────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline          // Requis iOS — évite le fullscreen automatique
        muted={false}        // L'audio TTS arrive via WebRTC audio track
        disablePictureInPicture
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          status === 'connected' || status === 'speaking' ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Avatar Jarvis en streaming"
      />

      {/* ── États de connexion ────────────────────────────────────────────── */}
      {(status === 'idle' || status === 'creating' || status === 'negotiating') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f1a]">
          {/* Indicateur visuel pendant la connexion WebRTC */}
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
            <div className="absolute inset-4 rounded-full bg-blue-600/40" />
          </div>
          <p className="text-sm font-medium text-blue-300/80 tracking-widest uppercase">
            {status === 'creating'    && 'Initialisation…'}
            {status === 'negotiating' && 'Connexion WebRTC…'}
            {status === 'idle'        && 'En attente'}
          </p>
        </div>
      )}

      {/* ── Erreur de connexion ───────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0f0f1a]">
          <div className="h-12 w-12 rounded-full bg-red-900/40 flex items-center justify-center">
            <span className="text-2xl">⚠</span>
          </div>
          <p className="text-sm text-red-400 text-center px-4">{error ?? 'Erreur WebRTC'}</p>
        </div>
      )}

      {/* ── Indicateur "parle" (overlay subtil) ──────────────────────────── */}
      {status === 'speaking' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 items-end h-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1 bg-blue-400/70 rounded-full animate-pulse"
              style={{
                height:          `${(i % 3 === 0 ? 100 : i % 3 === 1 ? 60 : 80)}%`,
                animationDelay:  `${i * 80}ms`,
                animationDuration: '600ms',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
