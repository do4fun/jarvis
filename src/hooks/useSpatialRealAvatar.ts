'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useSpatialRealAvatar — Cycle de vie complet de l'avatar SpatialReal
//
// Séquence d'initialisation :
//   1. AvatarSDK.initialize(appId, config)
//   2. AvatarManager.shared.load(avatarId) → Avatar
//   3. new AvatarView(avatar, containerEl) → rendu WebGL
//   4. POST /api/token → { token, url, room }
//   5. new AvatarPlayer(LiveKitProvider, avatarView) → connexion LiveKit
//   6. player.startPublishing() → micro utilisateur
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AvatarSDK,
  AvatarManager,
  AvatarView,
  DrivingServiceMode,
  Environment,
  type Avatar,
} from '@spatialwalk/avatarkit'
import { AvatarPlayer, LiveKitProvider } from '@spatialwalk/avatarkit-rtc'

// ── Diagnostic WebRTC + canvas — échantillonnage continu ─────────────────────
//
// Envoie 3 types d'entrées à POST /api/diag (JSONL append) :
//   connect   : snapshot statique au moment de la connexion
//   stats     : échantillon toutes les SAMPLE_INTERVAL_MS (delta bitrate, pertes…)
//   disconnect: résumé final
//
// Retourne une fonction stop() à appeler au disconnect.

const SAMPLE_INTERVAL_MS = 3_000

type LiveKitRoom = {
  remoteParticipants: Map<string, {
    identity: string
    trackPublications: Map<string, {
      trackName: string
      kind:      string
      track?: { mediaStreamTrack?: MediaStreamTrack }
    }>
  }>
  engine?: { pcManager?: { subscriber?: { pc?: RTCPeerConnection } } }
  on: (event: string, cb: (...args: unknown[]) => void) => void
  off: (event: string, cb: (...args: unknown[]) => void) => void
}

async function post(payload: Record<string, unknown>) {
  try {
    await fetch('/api/diag', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch { /* silencieux — le diagnostic ne doit pas bloquer l'appli */ }
}

function getSubscriberPc(room: LiveKitRoom): RTCPeerConnection | undefined {
  return room.engine?.pcManager?.subscriber?.pc
}

function snapshotTracks(room: LiveKitRoom): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const [, p] of room.remoteParticipants) {
    for (const [, pub] of p.trackPublications) {
      const mst = pub.track?.mediaStreamTrack
      if (!mst) continue
      const s = mst.getSettings()
      out.push({
        participant: p.identity,
        name: pub.trackName,
        kind: mst.kind,
        ...(mst.kind === 'video' && { width: s.width, height: s.height, frameRate: s.frameRate }),
      })
    }
  }
  return out
}

function snapshotCanvas(container: HTMLElement | null): Record<string, unknown> | null {
  const canvas = container?.querySelector('canvas')
  if (!canvas) return null
  const dpr = window.devicePixelRatio || 1
  return {
    internalW: canvas.width,
    internalH: canvas.height,
    cssW:      canvas.offsetWidth,
    cssH:      canvas.offsetHeight,
    expectedW: Math.round(canvas.offsetWidth  * dpr),
    expectedH: Math.round(canvas.offsetHeight * dpr),
    dpr,
    upscaled:  canvas.width < canvas.offsetWidth * dpr,
  }
}

function startAvatarDiagnostics(
  player:    AvatarPlayer,
  container: HTMLElement | null,   // div passé à AvatarView — contient le canvas
): () => void {
  const room = player.getNativeClient() as LiveKitRoom | null
  if (!room) return () => {}

  // ── Snapshot initial (tracks peut être vide si l'agent n'a pas encore publié) ─
  void post({ type: 'connect', tracks: snapshotTracks(room), canvas: snapshotCanvas(container) })

  // ── trackSubscribed : l'agent publie ses tracks après avoir rejoint la room ──
  const onTrackSubscribed = () => {
    void post({ type: 'track_subscribed', tracks: snapshotTracks(room) })
  }
  room.on('trackSubscribed', onTrackSubscribed)

  // ── Échantillonnage périodique (stats dynamiques) ─────────────────────────
  let prevBytes: Record<string, number> = {}
  let prevTime = Date.now()
  let sampleCount = 0

  const intervalId = setInterval(async () => {
    const pc = getSubscriberPc(room)
    if (!pc) return

    const now    = Date.now()
    const deltaT = (now - prevTime) / 1000   // secondes
    prevTime     = now
    sampleCount++

    const stats  = await pc.getStats()
    const sample: Record<string, unknown>[] = []

    stats.forEach(report => {
      if (report.type !== 'inbound-rtp') return
      const r         = report as RTCInboundRtpStreamStats & Record<string, unknown>
      const id        = `${String(r.kind)}-${String(r.ssrc ?? '')}`
      const bytes     = Number(r.bytesReceived ?? 0)
      const prevB     = prevBytes[id] ?? bytes
      const bitrate   = deltaT > 0 ? Math.round((bytes - prevB) * 8 / deltaT / 1000) : 0
      prevBytes[id]   = bytes

      sample.push({
        kind:          r.kind,
        bitrate_kbps:  bitrate,
        packetsLost:   r.packetsLost,
        jitter:        typeof r.jitter === 'number' ? Math.round(r.jitter * 1000) / 1000 : null,
        framesDecoded: r.framesDecoded,
        framesDropped: r.framesDropped,
        frameW:        r.frameWidth,
        frameH:        r.frameHeight,
      })
    })

    if (sample.length > 0) {
      void post({ type: 'stats', n: sampleCount, deltaT_s: Math.round(deltaT * 10) / 10, tracks: sample })
    }
  }, SAMPLE_INTERVAL_MS)

  // ── Stop — à appeler au disconnect ───────────────────────────────────────
  return () => {
    clearInterval(intervalId)
    room.off('trackSubscribed', onTrackSubscribed)
    void post({ type: 'disconnect', totalSamples: sampleCount })
  }
}

export type AvatarStatus =
  | 'idle'
  | 'initializing'
  | 'loading'
  | 'connecting'
  | 'connected'
  | 'error'

export interface SpatialRealAvatarController {
  status:               AvatarStatus
  error:                string | null
  downloadProgress:     number
  isPublishingMic:      boolean
  startPublishingMic:   () => Promise<void>
  stopPublishingMic:    () => Promise<void>
  reconnect:            () => Promise<void>
  /** Callback ref — passer directement à `ref={containerRef}` sur le div container */
  containerRef:         (node: HTMLDivElement | null) => void
}

interface Options {
  appId:    string
  avatarId: string
  room?:    string
}

export function useSpatialRealAvatar({ appId, avatarId, room = 'jarvis-room' }: Options): SpatialRealAvatarController {
  // containerInternalRef : accès synchrone au DOM (non-réactif)
  const containerInternalRef = useRef<HTMLDivElement | null>(null)
  // containerEl + containerReady : réactifs, déclenchent les effects
  const [containerEl,    setContainerEl]    = useState<HTMLDivElement | null>(null)
  const [containerReady, setContainerReady] = useState(false)

  const playerRef     = useRef<AvatarPlayer | null>(null)
  const avatarViewRef = useRef<AvatarView | null>(null)
  const connConfigRef = useRef<{ url: string; token: string; roomName: string } | null>(null)

  const [status,            setStatus]            = useState<AvatarStatus>('idle')
  const [error,             setError]             = useState<string | null>(null)
  const [downloadProgress,  setDownloadProgress]  = useState(0)
  const [isPublishingMic,   setIsPublishingMic]   = useState(false)

  // ── Callback ref — déclenche les effets dès que le div est monté/démonté ────
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerInternalRef.current = node
    setContainerEl(node)
    // Lecture immédiate des dimensions pour éviter un frame d'attente inutile
    setContainerReady(node !== null && node.offsetWidth > 0 && node.offsetHeight > 0)
  }, [])

  // ── ResizeObserver — confirme les dimensions réelles post-layout ─────────────
  //
  // AvatarView lit containerEl.offsetWidth/Height pour dimensionner son canvas
  // WebGL interne. Si le container est 0×0 (layout CSS non encore propagé, cas
  // fréquent avec dynamic import), le canvas est créé flou et ne se corrige plus.
  //
  // Le ResizeObserver garantit que containerReady passe à true UNIQUEMENT quand
  // le container a des dimensions CSS réelles (> 0px), déclenchant alors l'init.
  useEffect(() => {
    if (!containerEl) return

    const markReady = () => {
      setContainerReady(containerEl.offsetWidth > 0 && containerEl.offsetHeight > 0)
    }

    const observer = new ResizeObserver(markReady)
    observer.observe(containerEl)
    // requestAnimationFrame : vérifie après le premier paint complet du layout
    const frame = requestAnimationFrame(markReady)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [containerEl])

  // ── Initialisation — ne démarre QUE quand le container a des dimensions ──────
  useEffect(() => {
    if (!containerReady || !containerInternalRef.current) return

    let cancelled = false

    async function init() {
      const container = containerInternalRef.current!

      try {
        // 1. Init SDK (idempotent)
        setStatus('initializing')
        if (!AvatarSDK.isInitialized) {
          await AvatarSDK.initialize(appId, {
            environment:        Environment.intl,
            drivingServiceMode: DrivingServiceMode.host,
          })
        }
        if (cancelled) return

        // 2. Charger l'avatar (utilise le cache si déjà téléchargé)
        setStatus('loading')
        let avatar: Avatar
        const cached = AvatarManager.shared.retrieve(avatarId)
        if (cached) {
          avatar = cached
        } else {
          avatar = await AvatarManager.shared.load(avatarId, (info: unknown) => {
            if (
              info !== null &&
              typeof info === 'object' &&
              'progress' in info &&
              typeof (info as Record<string, unknown>).progress === 'number'
            ) {
              setDownloadProgress(Math.round((info as Record<string, unknown>).progress as number * 100))
            }
          })
        }
        if (cancelled) return

        // 3. Créer la vue WebGL APRÈS confirmation des dimensions du container.
        //    AvatarView dimensionne son canvas interne sur container.offsetWidth/Height.
        //    Si ces valeurs sont 0, le canvas est rendu flou par upscaling CSS.
        avatarViewRef.current?.dispose()
        avatarViewRef.current = new AvatarView(avatar, container)

        // 4. Obtenir le token LiveKit
        setStatus('connecting')
        const res = await fetch('/api/token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ room }),
        })
        if (!res.ok) throw new Error(`Token error ${res.status}`)
        const { token, url, room: roomName } = await res.json() as {
          token: string; url: string; room: string
        }
        if (cancelled) return

        connConfigRef.current = { url, token, roomName }
        AvatarSDK.setSessionToken(token)

        // 5. Créer et connecter le player
        const provider = new LiveKitProvider()
        const player   = new AvatarPlayer(provider, avatarViewRef.current)
        playerRef.current = player

        let stopDiag: (() => void) | undefined

        player.on('connected', () => {
          if (!cancelled) setStatus('connected')
          stopDiag = startAvatarDiagnostics(player, containerInternalRef.current)
        })
        player.on('disconnected', () => {
          stopDiag?.()
          if (!cancelled) setStatus('idle')
        })
        player.on('stalled', () => {
          if (!cancelled) void player.reconnect().catch(() => setStatus('error'))
        })
        player.on('error', (err: unknown) => {
          stopDiag?.()
          if (!cancelled) {
            setError(String(err))
            setStatus('error')
          }
        })

        await player.connect({ url, token, roomName })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setStatus('error')
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      playerRef.current?.disconnect().catch(() => {})
      avatarViewRef.current?.dispose()
      playerRef.current     = null
      avatarViewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, avatarId, room, containerReady])

  // ── Microphone ──────────────────────────────────────────────────────────────
  const startPublishingMic = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.startPublishing()
    setIsPublishingMic(true)
  }, [])

  const stopPublishingMic = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.stopPublishing()
    setIsPublishingMic(false)
  }, [])

  // ── Reconnexion manuelle ────────────────────────────────────────────────────
  const reconnect = useCallback(async () => {
    if (!playerRef.current || !connConfigRef.current) return
    setStatus('connecting')
    setError(null)
    try {
      // Re-fetch token (l'ancien peut avoir expiré)
      const res = await fetch('/api/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ room }),
      })
      if (!res.ok) throw new Error(`Token error ${res.status}`)
      const { token, url, room: roomName } = await res.json() as {
        token: string; url: string; room: string
      }
      connConfigRef.current = { url, token, roomName }
      AvatarSDK.setSessionToken(token)
      await playerRef.current.reconnect()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [room])

  return {
    status,
    error,
    downloadProgress,
    isPublishingMic,
    startPublishingMic,
    stopPublishingMic,
    reconnect,
    containerRef,
  }
}
