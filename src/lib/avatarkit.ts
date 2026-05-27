// ─────────────────────────────────────────────────────────────────────────────
// AvatarKit — Gestionnaire de sessions côté serveur (Singleton)
//
// Encapsule tous les appels REST vers l'API SpatialReal AvatarKit.
// La clé API ne quitte jamais le serveur Node.js.
//
// Optimisations latence :
//   1. Les chunks de texte sont transmis token par token (pas de batching)
//   2. sendTextChunk() est fire-and-forget : pas d'await dans la boucle SSE
//   3. Trickle ICE : les candidats sont envoyés dès leur génération
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@/lib/logger'
import type {
  AvatarKitSessionConfig,
  AvatarKitSessionDescriptor,
  AvatarKitTextChunk,
  AvatarKitInterruptPayload,
  AvatarKitSdpAnswer,
  AvatarKitIceCandidate,
} from '@/types/avatarkit'

const CTX = 'AvatarKitLib'

const BASE_URL =
  (process.env.AVATARKIT_API_URL ?? 'https://api.spatialreal.com/v1').replace(/\/$/, '')
const API_KEY = process.env.AVATARKIT_API_KEY ?? ''

if (!API_KEY && process.env.NODE_ENV !== 'test') {
  console.warn(
    `[${CTX}] AVATARKIT_API_KEY manquant — les sessions avatar échoueront.`,
  )
}

// ── Fetch helper interne ──────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)')
    throw new Error(`AvatarKit ${res.status} [${path}]: ${body}`)
  }

  return res.json() as Promise<T>
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Crée une nouvelle session de streaming.
 * Retourne l'offre SDP + serveurs ICE pour la négociation WebRTC côté client.
 */
export async function createSession(
  config: AvatarKitSessionConfig,
): Promise<AvatarKitSessionDescriptor> {
  logger.info(CTX, '→ createSession', { avatarId: config.avatarId, quality: config.quality })
  const session = await apiFetch<AvatarKitSessionDescriptor>('/sessions', {
    method: 'POST',
    body: JSON.stringify(config),
  })
  logger.info(CTX, '← session créée', { sessionId: session.sessionId })
  return session
}

/**
 * Soumet la réponse SDP du navigateur pour compléter la négociation WebRTC.
 *
 * Optimisation latence : appeler immédiatement après avoir créé le
 * RTCPeerConnection — avant même la fin de la collecte ICE (trickle ICE
 * s'en charge).
 */
export async function submitSdpAnswer(payload: AvatarKitSdpAnswer): Promise<void> {
  logger.info(CTX, '→ submitSdpAnswer', { sessionId: payload.sessionId })
  await apiFetch(`/sessions/${payload.sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ sdpAnswer: payload.sdpAnswer }),
  })
}

/**
 * Transfère un candidat ICE (trickle ICE — établissement de connexion plus rapide).
 * Ne pas attendre que la collecte complète soit terminée avant d'envoyer.
 */
export async function addIceCandidate(payload: AvatarKitIceCandidate): Promise<void> {
  await apiFetch(`/sessions/${payload.sessionId}/ice`, {
    method: 'POST',
    body: JSON.stringify({ candidate: payload.candidate }),
  })
}

/**
 * Ingère un fragment de texte pour le TTS en temps réel.
 *
 * Optimisation latence CRITIQUE : envoyer chaque token Claude immédiatement.
 * Ne PAS attendre une phrase complète — le moteur TTS d'AvatarKit gère la
 * détection des frontières de phrases en interne.
 *
 * Pattern d'usage dans la boucle SSE :
 *   for await (const chunk of claudeStream) {
 *     void sendTextChunk({ sessionId, text: chunk })  // fire-and-forget
 *   }
 *   await sendTextChunk({ sessionId, text: '', flush: true })
 */
export async function sendTextChunk(chunk: AvatarKitTextChunk): Promise<void> {
  await apiFetch(`/sessions/${chunk.sessionId}/text`, {
    method: 'POST',
    body: JSON.stringify({ text: chunk.text, flush: chunk.flush ?? false }),
  })
}

/**
 * Interrompt immédiatement la parole de l'avatar et arrête l'animation vidéo.
 *
 * Mécanisme barge-in : appelé quand l'utilisateur reprend la parole pendant
 * que l'avatar s'exprime. L'avatar revient à l'animation idle en un frame vidéo.
 */
export async function interruptSession(payload: AvatarKitInterruptPayload): Promise<void> {
  logger.info(CTX, '⚡ barge-in interrupt', { sessionId: payload.sessionId })
  await apiFetch(`/sessions/${payload.sessionId}/interrupt`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

/** Ferme proprement une session et libère les ressources côté serveur SpatialReal */
export async function closeSession(sessionId: string): Promise<void> {
  logger.info(CTX, '→ closeSession', { sessionId })
  await apiFetch(`/sessions/${sessionId}`, { method: 'DELETE' }).catch((err) =>
    logger.error(CTX, '✗ closeSession', { sessionId, err: String(err) }),
  )
}
