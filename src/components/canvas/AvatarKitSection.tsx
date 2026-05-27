'use client'

// ─────────────────────────────────────────────────────────────────────────────
// AvatarKitSection — Composant d'initialisation et affichage WebRTC
//
// Wrapper client-side pour AvatarKitPlayer :
//   - Lit la config depuis les variables d'environnement publiques (NEXT_PUBLIC_*)
//   - Fournit un fallback gracieux si NEXT_PUBLIC_AVATARKIT_AVATAR_ID est absent
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from 'next/dynamic'

// Import dynamique avec ssr: false — WebRTC et AudioContext ne fonctionnent
// que dans le navigateur (pas de SSR).
const AvatarKitPlayer = dynamic(
  () => import('./AvatarKitPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-[#0f0f1a] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
      </div>
    ),
  },
)

export default function AvatarKitSection() {
  const avatarId = process.env.NEXT_PUBLIC_AVATARKIT_AVATAR_ID

  if (!avatarId) {
    // En développement sans clé AvatarKit — afficher le placeholder
    return (
      <div className="h-full w-full bg-[#0f0f1a] flex flex-col items-center justify-center gap-4">
        <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-600 to-indigo-900 shadow-2xl shadow-blue-500/20 animate-pulse" />
        <p className="text-blue-400/50 text-xs tracking-widest uppercase">
          NEXT_PUBLIC_AVATARKIT_AVATAR_ID manquant
        </p>
      </div>
    )
  }

  return (
    <AvatarKitPlayer
      config={{
        avatarId: avatarId,
        quality:  (process.env.NEXT_PUBLIC_AVATARKIT_QUALITY as 'low' | 'medium' | 'high') ?? 'medium',
        language: process.env.NEXT_PUBLIC_AVATARKIT_LANGUAGE ?? 'fr-FR',
        voiceId:  process.env.NEXT_PUBLIC_AVATARKIT_VOICE_ID,
      }}
      className="h-full w-full"
    />
  )
}
