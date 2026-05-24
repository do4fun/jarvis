'use client'

import { useCallback } from 'react'
import { useChat } from './useChat'
import { useAudio } from './useAudio'
import { fetchTTS } from '@/services/elevenlabs'
import { useAvatarStore } from '@/store/useAvatarStore'
import type { AvatarResponse } from '@/types/avatar'
import type { AudioController } from './useAudio'

export interface JarvisController {
  sendMessage: (message: string) => Promise<void>
  /** AnalyserNode for amplitude-based lip-sync in useFrame */
  analyserNode: AudioController['analyserNode']
  /** Stop audio and return avatar to idle */
  stopSpeaking: () => void
}

export function useJarvis(): JarvisController {
  const { play, stop, analyserNode } = useAudio()
  const { setSpeaking } = useAvatarStore()

  const handleAvatarComplete = useCallback(
    async (response: AvatarResponse) => {
      try {
        const buffer = await fetchTTS(response.text)
        await play(buffer)
      } catch (err) {
        // TTS failed — avatar should not stay stuck in isSpeaking
        console.error('[useJarvis] TTS error:', err)
        setSpeaking(false)
      }
    },
    [play, setSpeaking],
  )

  const { sendMessage } = useChat({ onAvatarComplete: handleAvatarComplete })

  const stopSpeaking = useCallback(() => {
    stop()
    // Return avatar to idle posture
    useAvatarStore.getState().reset()
  }, [stop])

  return { sendMessage, analyserNode, stopSpeaking }
}
