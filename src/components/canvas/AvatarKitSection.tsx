'use client'

// ─────────────────────────────────────────────────────────────────────────────
// AvatarKitSection — Wrapper d'initialisation AvatarKit
//
// Lit la config depuis les variables NEXT_PUBLIC_* et fournit un fallback
// si les variables sont manquantes.
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from 'next/dynamic'

const AvatarKitPlayer = dynamic(() => import('./AvatarKitPlayer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0f0f1a] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
    </div>
  ),
})

export default function AvatarKitSection() {
  const avatarId = process.env.NEXT_PUBLIC_AVATARKIT_AVATAR_ID
  const appId    = process.env.NEXT_PUBLIC_SPATIALREAL_APP_ID

  if (!avatarId || !appId) {
    return (
      <div className="h-full w-full bg-[#0f0f1a] flex flex-col items-center justify-center gap-4">
        <div className="h-32 w-32 rounded-full bg-linear-to-br from-blue-600 to-indigo-900 shadow-2xl shadow-blue-500/20 animate-pulse" />
        <p className="text-blue-400/50 text-xs tracking-widest uppercase">
          {!appId    ? 'NEXT_PUBLIC_SPATIALREAL_APP_ID manquant'    : ''}
          {!avatarId ? 'NEXT_PUBLIC_AVATARKIT_AVATAR_ID manquant' : ''}
        </p>
      </div>
    )
  }

  return (
    <AvatarKitPlayer
      appId={appId}
      avatarId={avatarId}
      className="h-full w-full"
    />
  )
}
