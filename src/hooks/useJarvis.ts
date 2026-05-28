'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useJarvis — Orchestrateur text chat (Option A)
//
// En mode LiveKit (Option A), la pipeline voix complète (STT → LLM → TTS →
// Avatar) est gérée par l'agent Python côté serveur. Ce hook ne gère que
// l'interface texte : saisie clavier → Claude SSE → affichage de la réponse.
//
// Le microphone et la voix de l'avatar sont gérés par AvatarKitPlayer via
// useSpatialRealAvatar (player.startPublishing / stopPublishing).
// ─────────────────────────────────────────────────────────────────────────────

import { useChat } from './useChat'
import { useAvatarStore } from '@/store/useAvatarStore'
import type { AvatarResponse } from '@/types/avatar'
import { useCallback } from 'react'

export interface JarvisController {
  sendMessage: (message: string) => Promise<void>
  isLoading:   boolean
}

export function useJarvis(): JarvisController {
  const { applyAvatarResponse } = useAvatarStore()

  const handleAvatarComplete = useCallback(
    async (response: AvatarResponse) => {
      applyAvatarResponse(response)
    },
    [applyAvatarResponse],
  )

  const { sendMessage } = useChat({ onAvatarComplete: handleAvatarComplete })

  // isLoading est lu directement depuis useConversationStore par les consommateurs
  return { sendMessage, isLoading: false }
}
