'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useAvatarKit — Hook de gestion de la session WebRTC AvatarKit
//
// Responsabilités :
//   1. Appel POST /api/avatar/session → récupère SDP offer + ICE servers
//   2. Crée RTCPeerConnection avec les ICE servers fournis
//   3. Collecte et envoie les candidats ICE en trickle (un par un)
//   4. Soumet la SDP answer via POST /api/avatar/ice
//   5. Reçoit le MediaStream vidéo dès que WebRTC est établi
//   6. Expose interrupt() pour le mécanisme barge-in
//
// Optimisations latence :
//   - Trickle ICE : chaque candidat est envoyé dès sa génération
//   - ontrack handler immédiat : flux vidéo attaché sans buffering
//   - createOffer/setLocalDescription au plus tôt pour démarrer la collecte ICE
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react'
import { useAvatarKitStore } from '@/store/useAvatarKitStore'
import type { AvatarKitSessionConfig, AvatarKitSessionDescriptor } from '@/types/avatarkit'

export interface AvatarKitController {
  /** Lance la session WebRTC. Appeler une seule fois au montage du composant. */
  connect: (config: AvatarKitSessionConfig) => Promise<void>
  /** Interruption immédiate (barge-in) : arrête le stream Claude + l'avatar */
  interrupt: () => Promise<void>
  /** Ferme proprement la session WebRTC */
  disconnect: () => void
}

export function useAvatarKit(): AvatarKitController {
  const { setStatus, setSessionId, setMediaStream, setError, reset, sessionId } =
    useAvatarKitStore()

  // Ref vers RTCPeerConnection — pas dans le store (non-sérialisable)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  // Nettoyage automatique à la destruction du composant
  useEffect(() => {
    return () => {
      pcRef.current?.close()
      pcRef.current = null
      reset()
    }
  }, [reset])

  const connect = useCallback(
    async (config: AvatarKitSessionConfig) => {
      setStatus('creating')
      setError(null)

      try {
        // ── 1. Créer la session AvatarKit côté serveur ────────────────────────
        const res = await fetch('/api/avatar/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(err.error ?? `Échec création session: ${res.status}`)
        }

        const descriptor: AvatarKitSessionDescriptor = await res.json()
        setSessionId(descriptor.sessionId)
        setStatus('negotiating')

        // ── 2. Créer RTCPeerConnection avec les ICE servers AvatarKit ─────────
        const pc = new RTCPeerConnection({
          iceServers:         descriptor.iceServers,
          // Optimisation : politique agressive pour trouver des candidats locaux
          iceTransportPolicy: 'all',
          bundlePolicy:       'max-bundle',
        })
        pcRef.current = pc

        // ── 3. Réception du flux vidéo WebRTC ─────────────────────────────────
        // Optimisation latence : setMediaStream dès le premier track reçu,
        // sans attendre la connexion complète.
        pc.ontrack = (evt) => {
          if (evt.streams[0]) {
            setMediaStream(evt.streams[0])
            setStatus('connected')
          }
        }

        // ── 4. Trickle ICE — envoyer chaque candidat dès sa génération ────────
        pc.onicecandidate = ({ candidate }) => {
          if (!candidate) return // null = fin de collecte, déjà géré en local
          // Fire-and-forget : ne pas bloquer la collecte ICE
          void fetch('/api/avatar/ice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind:      'iceCandidate',
              sessionId: descriptor.sessionId,
              candidate: candidate.toJSON(),
            }),
          })
        }

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed') {
            setError('Connexion WebRTC échouée')
            setStatus('error')
          }
          if (pc.connectionState === 'closed') {
            setStatus('closed')
          }
        }

        // ── 5. Appliquer l'offre SDP d'AvatarKit ─────────────────────────────
        await pc.setRemoteDescription(new RTCSessionDescription(descriptor.sdpOffer))

        // ── 6. Créer la réponse SDP et lancer la collecte ICE ─────────────────
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        // ── 7. Envoyer la SDP answer au backend → forwarded à AvatarKit ───────
        await fetch('/api/avatar/ice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind:      'sdpAnswer',
            sessionId: descriptor.sessionId,
            sdpAnswer: answer,
          }),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setStatus('error')
        console.error('[useAvatarKit] connect error:', message)
      }
    },
    [setStatus, setError, setSessionId, setMediaStream],
  )

  const interrupt = useCallback(async () => {
    const sid = useAvatarKitStore.getState().sessionId
    if (!sid) return

    setStatus('interrupted')

    try {
      await fetch('/api/avatar/interrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarSessionId: sid }),
      })
    } catch (err) {
      console.error('[useAvatarKit] interrupt error:', err)
    }
  }, [setStatus])

  const disconnect = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    reset()
  }, [reset])

  return { connect, interrupt, disconnect }
}
