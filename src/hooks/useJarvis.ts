'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useJarvis — Orchestrateur principal (v2 avec WebRTC + barge-in)
//
// Pipeline complet :
//   1. Voice input (micro → WebSocket STT → transcript)
//   2. Chat LLM (transcript/texte → Claude stream → SSE)
//   3. AvatarKit TTS (tokens → AvatarKit API → vidéo WebRTC)
//   4. Barge-in (VAD → AbortController + interrupt AvatarKit)
//
// Ce hook remplace useAudio + fetchTTS par le pipeline WebRTC AvatarKit.
// Le composant AvatarKitPlayer reçoit le MediaStream via useAvatarKitStore.
//
// Modifications v2 vs v1 :
//   - Plus de fetchTTS ni de Web Audio API (remplacés par AvatarKit WebRTC)
//   - sendMessage() inclut maintenant avatarSessionId dans le body
//   - Ajout de interrupt() pour le barge-in
//   - Ajout de useVoiceInput pour le STT temps réel
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef } from 'react'
import { useChat } from './useChat'
import { useAvatarKit } from './useAvatarKit'
import { useVoiceInput } from './useVoiceInput'
import { useAvatarStore } from '@/store/useAvatarStore'
import { useAvatarKitStore } from '@/store/useAvatarKitStore'
import type { AvatarResponse } from '@/types/avatar'

export interface JarvisController {
  /** Envoie un message texte à Claude (saisie clavier) */
  sendMessage: (message: string) => Promise<void>

  /** Lance la capture microphone pour STT temps réel */
  startListening: () => Promise<void>

  /** Arrête la capture microphone */
  stopListening: () => void

  /** Indique si le microphone est actif */
  isListening: boolean

  /** Transcript STT courant (peut être intermédiaire) */
  transcript: string

  /**
   * Interrompt immédiatement l'avatar (barge-in manuel).
   * Annule le stream Claude en cours + arrête la parole AvatarKit.
   */
  interrupt: () => Promise<void>

  /** @deprecated Utilisé uniquement si AvatarKit n'est pas disponible */
  stopSpeaking: () => void
}

export function useJarvis(): JarvisController {
  const { applyAvatarResponse, reset: resetAvatar, setSpeaking } = useAvatarStore()
  const { sessionId, status: avatarKitStatus }                   = useAvatarKitStore()
  const { interrupt: avatarKitInterrupt }                        = useAvatarKit()

  // Référence au message courant pour envoyer depuis le callback STT
  const pendingTranscript = useRef<string>('')

  // ── Callback quand Claude finit de générer ────────────────────────────────
  // En mode WebRTC : l'avatar a déjà commencé à parler via AvatarKit TTS.
  // On applique seulement les métadonnées (animation, emotion) au store.
  const handleAvatarComplete = useCallback(
    async (response: AvatarResponse) => {
      applyAvatarResponse(response) // Met à jour animation, emotion, environment
      setSpeaking(true)
      // Pas de fetchTTS ni de play() — AvatarKit gère le TTS via WebRTC
    },
    [applyAvatarResponse, setSpeaking],
  )

  // ── Barge-in ──────────────────────────────────────────────────────────────
  const interrupt = useCallback(async () => {
    // 1. Interrompre AvatarKit (arrêt vidéo + TTS immédiat)
    await avatarKitInterrupt()
    // 2. Reset avatar store → état idle
    resetAvatar()
    setSpeaking(false)
  }, [avatarKitInterrupt, resetAvatar, setSpeaking])

  // ── Hook chat (SSE) ───────────────────────────────────────────────────────
  // sendMessage est enrichi pour inclure avatarSessionId dans le body HTTP
  const { sendMessage: sendChatMessage } = useChat({
    onAvatarComplete: handleAvatarComplete,
  })

  const sendMessage = useCallback(
    async (message: string) => {
      // Injecter le sessionId AvatarKit dans la requête chat
      // Le handler /api/chat utilisera ce sessionId pour streamer le texte
      // directement vers AvatarKit (sans passer par le client)
      if (sessionId) {
        // Monkey-patch temporaire : on surcharge le comportement de useChat
        // en modifiant le body de la requête via le ChatRequest étendu
        await (sendChatMessage as (msg: string, opts?: { avatarSessionId?: string }) => Promise<void>)(
          message,
          { avatarSessionId: sessionId },
        )
      } else {
        await sendChatMessage(message)
      }
    },
    [sendChatMessage, sessionId],
  )

  // ── Voice input (STT) ─────────────────────────────────────────────────────
  const { isListening, transcript, startListening, stopListening } = useVoiceInput({
    onTranscript: (text, isFinal) => {
      pendingTranscript.current = text
      if (isFinal && text.trim()) {
        // Transcript final → envoi automatique à Claude
        void sendMessage(text)
        pendingTranscript.current = ''
      }
    },
    onBargeIn: () => {
      // VAD a détecté que l'utilisateur parle pendant que l'avatar s'exprime
      void interrupt()
    },
    isSpeaking: () => useAvatarKitStore.getState().status === 'speaking',
  })

  const startListeningWithSession = useCallback(async () => {
    await startListening(sessionId ?? undefined)
  }, [startListening, sessionId])

  const stopSpeaking = useCallback(() => {
    // Fallback pour compatibilité avec le mode sans AvatarKit
    if (avatarKitStatus === 'idle' || avatarKitStatus === 'error') {
      resetAvatar()
      setSpeaking(false)
    }
  }, [avatarKitStatus, resetAvatar, setSpeaking])

  return {
    sendMessage,
    startListening: startListeningWithSession,
    stopListening,
    isListening,
    transcript,
    interrupt,
    stopSpeaking,
  }
}
