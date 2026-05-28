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
  Environment,
  type Avatar,
} from '@spatialwalk/avatarkit'
import { AvatarPlayer, LiveKitProvider } from '@spatialwalk/avatarkit-rtc'

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
  containerRef:         React.RefObject<HTMLDivElement | null>
}

interface Options {
  appId:    string
  avatarId: string
  room?:    string
}

export function useSpatialRealAvatar({ appId, avatarId, room = 'jarvis-room' }: Options): SpatialRealAvatarController {
  const containerRef    = useRef<HTMLDivElement | null>(null)
  const playerRef       = useRef<AvatarPlayer | null>(null)
  const avatarViewRef   = useRef<AvatarView | null>(null)
  const connConfigRef   = useRef<{ url: string; token: string; roomName: string } | null>(null)

  const [status,            setStatus]            = useState<AvatarStatus>('idle')
  const [error,             setError]             = useState<string | null>(null)
  const [downloadProgress,  setDownloadProgress]  = useState(0)
  const [isPublishingMic,   setIsPublishingMic]   = useState(false)

  // ── Initialisation ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      const container = containerRef.current
      if (!container) return

      try {
        // 1. Init SDK (idempotent)
        setStatus('initializing')
        if (!AvatarSDK.isInitialized) {
          await AvatarSDK.initialize(appId, {
            environment:       Environment.intl,
            logLevel:          'warning' as never,
          })
        }
        if (cancelled) return

        // 2. Charger l'avatar
        setStatus('loading')
        let avatar: Avatar
        const cached = AvatarManager.shared.retrieve(avatarId)
        if (cached) {
          avatar = cached
        } else {
          avatar = await AvatarManager.shared.load(avatarId, (info) => {
            if ('progress' in info && typeof info.progress === 'number') {
              setDownloadProgress(Math.round(info.progress * 100))
            }
          })
        }
        if (cancelled) return

        // 3. Créer la vue WebGL
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

        player.on('connected',    () => { if (!cancelled) setStatus('connected') })
        player.on('disconnected', () => { if (!cancelled) setStatus('idle') })
        player.on('stalled',      () => {
          if (!cancelled) void player.reconnect().catch(() => setStatus('error'))
        })
        player.on('error', (err: unknown) => {
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
      playerRef.current  = null
      avatarViewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, avatarId, room])

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
