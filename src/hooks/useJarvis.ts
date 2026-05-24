'use client'

import { useCallback } from 'react'
import { useChat } from './useChat'
import { useAudio } from './useAudio'
import { fetchTTS } from '@/services/elevenlabs'
import { useAvatarStore } from '@/store/useAvatarStore'
import { useSettingsStore } from '@/store/useSettingsStore'
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
  const { setSpeaking }  = useAvatarStore()
  const { ttsEnabled }   = useSettingsStore()

  const handleAvatarComplete = useCallback(
    async (response: AvatarResponse) => {
      if (!ttsEnabled) return // TTS désactivé dans les préférences

      try {
        const buffer = await fetchTTS(response.text)
        await play(buffer)
      } catch (err) {
        console.error('[useJarvis] TTS error:', err)
        setSpeaking(false)
      }
    },
    [play, setSpeaking, ttsEnabled],
  )

  const { sendMessage } = useChat({ onAvatarComplete: handleAvatarComplete })

  const stopSpeaking = useCallback(() => {
    stop()
    useAvatarStore.getState().reset()
  }, [stop])

  return { sendMessage, analyserNode, stopSpeaking }
}
