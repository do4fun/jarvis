// ─────────────────────────────────────────────────────────────────────────────
// STT — Service de transcription temps réel via Deepgram
//
// Reçoit de l'audio PCM16 depuis le WebSocket navigateur et retourne des
// transcriptions au fil de l'eau (interim + final).
//
// Optimisations latence :
//   1. Nova-2 avec interim_results=true → premier mot transcrit en ~100ms
//   2. endpointing=300ms → détection de fin de phrase rapide
//   3. encoding=linear16 → pas de décodage codec côté serveur
//   4. La connexion Deepgram est persistante (keep-alive) par session WebSocket
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import type { WebSocket } from 'ws'
import { logger } from '@/lib/logger'
import type { WsServerMessage } from '@/types/avatarkit'

const CTX = 'STT'

// Singleton Deepgram client — initialisé lazily pour éviter un crash au
// démarrage si DEEPGRAM_API_KEY est absent.
let _deepgramClient: ReturnType<typeof createClient> | null = null

function getDeepgramClient() {
  if (_deepgramClient) return _deepgramClient
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) {
    logger.warn(CTX, 'DEEPGRAM_API_KEY manquant — STT désactivé')
    return null
  }
  _deepgramClient = createClient(key)
  return _deepgramClient
}

// ── Session STT ────────────────────────────────────────────────────────────────

export interface STTSession {
  /** Envoie un buffer audio PCM16 à Deepgram */
  sendAudio: (buffer: Buffer) => void
  /** Ferme proprement la connexion Deepgram */
  close: () => void
}

/**
 * Crée une session STT Deepgram liée à un WebSocket client.
 *
 * Chaque fragment audio PCM16 envoyé via `sendAudio()` est transmis en temps
 * réel à Deepgram. Les transcriptions sont renvoyées au client WebSocket
 * dès leur disponibilité (interim) ou finalisation.
 */
export function createSTTSession(
  clientWs: WebSocket,
  language = 'fr',
): STTSession {
  logger.info(CTX, '→ createSTTSession', { language })

  const client = getDeepgramClient()
  if (!client) {
    logger.warn(CTX, 'STT ignoré — DEEPGRAM_API_KEY absent')
    return { sendAudio: () => {}, close: () => {} }
  }

  const live = client.listen.live({
    model: 'nova-2',
    language,
    smart_format: true,
    // Optimisation : résultats intermédiaires pour affichage immédiat
    interim_results: true,
    // 300ms de silence = fin d'énoncé — envoie le transcript final
    endpointing: 300,
    // PCM16 brut @ 16kHz mono — zéro latence de codec côté navigateur
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
    // Suppression de bruit pour améliorer la précision
    filler_words: false,
  })

  const send = (msg: WsServerMessage) => {
    if (clientWs.readyState === 1 /* OPEN */) {
      clientWs.send(JSON.stringify(msg))
    }
  }

  live.on(LiveTranscriptionEvents.Open, () => {
    logger.info(CTX, '✓ Deepgram connexion ouverte')
    send({ type: 'ready' })
  })

  live.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data.channel?.alternatives?.[0]
    if (!alt?.transcript) return

    send({
      type: 'transcript',
      text: alt.transcript,
      isFinal: data.is_final === true,
    })
  })

  live.on(LiveTranscriptionEvents.Error, (err) => {
    logger.error(CTX, '✗ Deepgram error', { err: String(err) })
    send({ type: 'error', message: String(err) })
  })

  live.on(LiveTranscriptionEvents.Close, () => {
    logger.info(CTX, '← Deepgram connexion fermée')
  })

  return {
    sendAudio: (buffer: Buffer) => {
      // Convertir Buffer en ArrayBuffer pour la compatibilité avec le SDK Deepgram
      // (Deepgram attend SocketDataLike = ArrayBuffer | SharedArrayBuffer | Blob)
      try {
        const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        live.send(ab as ArrayBuffer)
      } catch {
        // Ignorer les erreurs si la connexion est fermée (ex. barge-in)
      }
    },
    close: () => {
      try {
        live.finish()
      } catch {
        // Ignorer les erreurs de fermeture double
      }
    },
  }
}
