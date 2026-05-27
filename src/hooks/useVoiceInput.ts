'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useVoiceInput — Capture microphone + STT temps réel via WebSocket
//
// Pipeline audio (chemin critique latence) :
//   Micro → AudioContext (16kHz mono) → AudioWorklet (PCM16, 128 samples=8ms)
//   → WebSocket /ws/stt → Deepgram → transcript → onTranscript callback
//
// Mécanisme barge-in :
//   Un VAD (Voice Activity Detection) simplifié mesure l'énergie RMS du signal.
//   Si l'énergie dépasse le seuil VAD_THRESHOLD pendant que l'avatar parle,
//   un message { type: 'barge_in' } est envoyé via WebSocket ET l'interrupt
//   REST est appelé côté hook parent (useJarvis).
//
// Optimisations latence :
//   1. AudioWorklet dans le thread audio (non bloquant sur le thread principal)
//   2. PCM16 brut → pas d'encodage côté navigateur
//   3. WebSocket persistent (pas de reconnexion par message)
//   4. Deepgram interim_results → premier mot visible en ~100ms
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react'
import type { WsClientMessage, WsServerMessage } from '@/types/avatarkit'

// Seuil d'énergie RMS pour la détection de voix (0–1)
const VAD_THRESHOLD = 0.015

// Fréquence d'échantillonnage cible (Deepgram recommande 16kHz)
const TARGET_SAMPLE_RATE = 16_000

export interface VoiceInputController {
  isListening:  boolean
  transcript:   string
  startListening: (avatarSessionId?: string) => Promise<void>
  stopListening:  () => void
}

interface UseVoiceInputOptions {
  onTranscript:   (text: string, isFinal: boolean) => void
  onBargeIn?:     () => void
  /** Retourne true si l'avatar est en train de parler (pour le VAD barge-in) */
  isSpeaking?: () => boolean
}

export function useVoiceInput({
  onTranscript,
  onBargeIn,
  isSpeaking,
}: UseVoiceInputOptions): VoiceInputController {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript]   = useState('')

  // Refs (non-réactifs — survivent aux re-renders)
  const wsRef          = useRef<WebSocket | null>(null)
  const audioCtxRef    = useRef<AudioContext | null>(null)
  const workletRef     = useRef<AudioWorkletNode | null>(null)
  const sourceRef      = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef      = useRef<MediaStream | null>(null)
  const sessionIdRef   = useRef<string | undefined>(undefined)

  const stopListening = useCallback(() => {
    // Arrêter l'AudioWorklet
    workletRef.current?.port.postMessage('stop')
    workletRef.current?.disconnect()
    workletRef.current = null

    // Libérer la source micro
    sourceRef.current?.disconnect()
    sourceRef.current = null

    // Arrêter les pistes micro (LED micro éteinte)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    // Fermer l'AudioContext
    audioCtxRef.current?.close().catch(() => null)
    audioCtxRef.current = null

    // Fermer le WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }
    wsRef.current = null

    setIsListening(false)
  }, [])

  const startListening = useCallback(
    async (avatarSessionId?: string) => {
      if (isListening) return
      sessionIdRef.current = avatarSessionId

      try {
        // ── 1. Demander l'accès au microphone ────────────────────────────────
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate:        TARGET_SAMPLE_RATE,
            channelCount:      1,
            echoCancellation:  true,
            noiseSuppression:  true,
            autoGainControl:   true,
          },
        })
        streamRef.current = stream

        // ── 2. Créer AudioContext à 16kHz ─────────────────────────────────────
        const audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
        audioCtxRef.current = audioCtx

        // ── 3. Charger l'AudioWorklet PCM16 ──────────────────────────────────
        await audioCtx.audioWorklet.addModule('/worklets/audio-capture.js')
        const worklet = new AudioWorkletNode(audioCtx, 'audio-capture')
        workletRef.current = worklet

        // ── 4. Connecter micro → worklet ──────────────────────────────────────
        const source = audioCtx.createMediaStreamSource(stream)
        sourceRef.current = source
        source.connect(worklet)
        // Ne pas connecter worklet → destination (pas de retour micro)

        // ── 5. Ouvrir WebSocket vers le serveur STT ────────────────────────────
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/stt`)
        wsRef.current = ws

        ws.onopen = () => {
          // Configurer la langue dès l'ouverture
          const configMsg: WsClientMessage = { type: 'config', language: 'fr' }
          ws.send(JSON.stringify(configMsg))
        }

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data as string) as WsServerMessage
            if (msg.type === 'transcript') {
              setTranscript(msg.text)
              onTranscript(msg.text, msg.isFinal)
            }
          } catch {
            // Ignorer les messages malformés
          }
        }

        ws.onclose  = () => setIsListening(false)
        ws.onerror  = () => console.error('[useVoiceInput] WebSocket error')

        // ── 6. Transférer les chunks PCM16 via WebSocket ──────────────────────
        worklet.port.onmessage = (evt: MessageEvent<ArrayBuffer>) => {
          if (ws.readyState !== WebSocket.OPEN) return

          // VAD simplifié : calculer l'énergie RMS du chunk
          const int16 = new Int16Array(evt.data)
          let sumSq = 0
          for (let i = 0; i < int16.length; i++) {
            const sample = int16[i] / 32768
            sumSq += sample * sample
          }
          const rms = Math.sqrt(sumSq / int16.length)

          // Barge-in : l'utilisateur parle pendant que l'avatar s'exprime
          if (rms > VAD_THRESHOLD && isSpeaking?.()) {
            onBargeIn?.()
            // Signaler le barge-in au backend via WebSocket
            if (avatarSessionId) {
              const bargeMsg: WsClientMessage = {
                type:            'barge_in',
                avatarSessionId: avatarSessionId,
              }
              ws.send(JSON.stringify(bargeMsg))
            }
          }

          // Envoyer l'audio PCM16 brut comme ArrayBuffer
          // (Deepgram accepte les frames binaires directement)
          const audioMsg: WsClientMessage = {
            type: 'audio_chunk',
            // Convertir ArrayBuffer en base64 pour le transport JSON
            data: btoa(String.fromCharCode(...new Uint8Array(evt.data))),
          }
          ws.send(JSON.stringify(audioMsg))
        }

        setIsListening(true)
      } catch (err) {
        console.error('[useVoiceInput] Erreur démarrage:', err)
        stopListening()
      }
    },
    [isListening, onTranscript, onBargeIn, isSpeaking, stopListening],
  )

  return { isListening, transcript, startListening, stopListening }
}
