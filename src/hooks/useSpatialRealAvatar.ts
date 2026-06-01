'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useSpatialRealAvatar — SDK mode (WebSocket direct SpatialReal, sans LiveKit)
//
// Séquence d'initialisation :
//   1. POST /api/avatar-token → { sessionToken, appId, avatarId }
//   2. AvatarSDK.initialize(appId, { drivingServiceMode: sdk })
//   3. AvatarSDK.setSessionToken(sessionToken)
//   4. AvatarManager.shared.load(avatarId) → Avatar
//   5. new AvatarView(avatar, containerEl) → canvas WebGL
//   6. controller.start() → WebSocket SpatialReal
//
// Pour faire parler l'avatar :
//   speak(pcmBuffer) → controller.send(pcmBuffer, true)
//   Le PCM doit être : 16 kHz, 16-bit signé, mono (format ElevenLabs pcm_16000)
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

export type AvatarStatus =
  | 'idle'
  | 'initializing'
  | 'loading'
  | 'connecting'
  | 'connected'
  | 'error'

export interface SpatialRealAvatarController {
  status:           AvatarStatus
  error:            string | null
  downloadProgress: number
  /** Envoie un buffer PCM 16kHz mono à l'avatar pour lip-sync */
  speak:            (pcmAudio: ArrayBuffer) => Promise<void>
  reconnect:        () => Promise<void>
  containerRef:     (node: HTMLDivElement | null) => void
}

export function useSpatialRealAvatar(): SpatialRealAvatarController {
  const containerInternalRef = useRef<HTMLDivElement | null>(null)
  const [containerEl,    setContainerEl]    = useState<HTMLDivElement | null>(null)
  const [containerReady, setContainerReady] = useState(false)

  const avatarViewRef = useRef<AvatarView | null>(null)

  const [status,           setStatus]           = useState<AvatarStatus>('idle')
  const [error,            setError]            = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // ── Callback ref ─────────────────────────────────────────────────────────────
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerInternalRef.current = node
    setContainerEl(node)
    setContainerReady(node !== null && node.offsetWidth > 0 && node.offsetHeight > 0)
  }, [])

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerEl) return
    const markReady = () =>
      setContainerReady(containerEl.offsetWidth > 0 && containerEl.offsetHeight > 0)
    const observer = new ResizeObserver(markReady)
    observer.observe(containerEl)
    const frame = requestAnimationFrame(markReady)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [containerEl])

  // ── Initialisation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerReady || !containerInternalRef.current) return
    let cancelled = false

    async function init() {
      const container = containerInternalRef.current!
      try {
        setStatus('initializing')

        // 1. Credentials depuis le serveur
        const tokenRes = await fetch('/api/avatar-token', { method: 'POST' })
        if (!tokenRes.ok) throw new Error(`avatar-token ${tokenRes.status}`)
        const { sessionToken, appId, avatarId } =
          await tokenRes.json() as { sessionToken: string; appId: string; avatarId: string }
        if (cancelled) return

        // 2. Init SDK (idempotent)
        if (!AvatarSDK.isInitialized) {
          await AvatarSDK.initialize(appId, {
            environment:        Environment.intl,
            drivingServiceMode: DrivingServiceMode.sdk,
          })
        }
        AvatarSDK.setSessionToken(sessionToken)
        if (cancelled) return

        // 3. Charger l'avatar
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
              setDownloadProgress(
                Math.round((info as Record<string, unknown>).progress as number * 100),
              )
            }
          })
        }
        if (cancelled) return

        // 4. Créer la vue WebGL
        avatarViewRef.current?.dispose()
        avatarViewRef.current = new AvatarView(avatar, container)

        // 5. Connecter via WebSocket SpatialReal
        setStatus('connecting')

        const ctrl = (avatarViewRef.current as unknown as {
          controller: {
            initializeAudioContext(): Promise<void>
            start(): Promise<void>
            onConnectionState?: (state: string) => void
          }
        }).controller

        ctrl.onConnectionState = (state: string) => {
          if (cancelled) return
          if (state === 'connected')    setStatus('connected')
          else if (state === 'disconnected') setStatus('idle')
          else if (state === 'error')   setStatus('error')
        }

        await ctrl.initializeAudioContext()
        await ctrl.start()

        if (!cancelled) setStatus('connected')
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
      avatarViewRef.current?.dispose()
      avatarViewRef.current = null
    }
  }, [containerReady])

  // ── Speak — envoie PCM à SpatialReal ────────────────────────────────────────
  const speak = useCallback(async (pcmAudio: ArrayBuffer) => {
    const view = avatarViewRef.current
    if (!view) return
    const ctrl = (view as unknown as {
      controller: { send(audio: ArrayBuffer, isFinal: boolean): void }
    }).controller
    ctrl.send(pcmAudio, true)
  }, [])

  // ── Reconnexion ──────────────────────────────────────────────────────────────
  const reconnect = useCallback(async () => {
    const view = avatarViewRef.current
    if (!view) return
    try {
      setStatus('connecting')
      setError(null)
      const ctrl = (view as unknown as {
        controller: { start(): Promise<void> }
      }).controller
      await ctrl.start()
      setStatus('connected')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [])

  return { status, error, downloadProgress, speak, reconnect, containerRef }
}
