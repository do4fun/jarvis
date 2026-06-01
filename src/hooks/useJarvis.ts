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
  const { applyAvatarResponse, speak } = useAvatarStore()

  const handleAvatarComplete = useCallback(
    async (response: AvatarResponse) => {
      applyAvatarResponse(response)

      // SDK mode : TTS → PCM → controller.send()
      if (!speak || !response.text?.trim()) return

      try {
        const res = await fetch('/api/tts-pcm', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text: response.text }),
        })
        if (!res.ok) {
          console.error('[Jarvis] tts-pcm error', res.status)
          return
        }
        const pcmBuffer = await res.arrayBuffer()
        await speak(pcmBuffer)
      } catch (err) {
        console.error('[Jarvis] speak error', err)
      }
    },
    [applyAvatarResponse, speak],
  )

  const { sendMessage } = useChat({ onAvatarComplete: handleAvatarComplete })

  return { sendMessage, isLoading: false }
}
