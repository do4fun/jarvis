'use client'

import { useCallback } from 'react'
import { useChat } from './useChat'
import { useAvatarStore } from '@/store/useAvatarStore'
import type { AvatarResponse } from '@/types/avatar'

export interface JarvisController {
  sendMessage: (message: string) => Promise<void>
  isLoading:   boolean
}

export function useJarvis(): JarvisController {
  const { applyAvatarResponse } = useAvatarStore()

  const handleAvatarComplete = useCallback(
    async (response: AvatarResponse) => {
      applyAvatarResponse(response)
      // La voix est gérée par l'agent Python via LiveKit data channel (voir /api/chat)
    },
    [applyAvatarResponse],
  )

  const { sendMessage } = useChat({ onAvatarComplete: handleAvatarComplete })
  return { sendMessage, isLoading: false }
}
