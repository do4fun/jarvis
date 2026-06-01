'use client'

import { useCallback, useRef, useState } from 'react'
import {
  AvatarSDK,
  AvatarManager,
  AvatarView,
  DrivingServiceMode,
  Environment,
} from '@spatialwalk/avatarkit'

const DEMO_PCM_URL = 'https://cdn.spatialwalk.cloud/public/website/quickstart_voice.pcm'

type AvatarController = {
  onConnectionState: ((state: string) => void) | null
  initializeAudioContext(): Promise<void>
  start(): Promise<void>
  close(): void
  send(audio: ArrayBuffer, isFinal: boolean): void
}

function getController(view: AvatarView): AvatarController {
  return (view as unknown as { controller: AvatarController }).controller
}

export default function JarvisAvatar() {
  const containerRef  = useRef<HTMLDivElement | null>(null)
  const avatarViewRef = useRef<AvatarView | null>(null)

  const [connecting, setConnecting] = useState(false)
  const [connected,  setConnected]  = useState(false)
  const [sending,    setSending]    = useState(false)
  const [status,     setStatus]     = useState('Cliquer "Connecter" pour démarrer')

  const connectAvatar = useCallback(async () => {
    if (connecting || connected) return
    setConnecting(true)
    setStatus('Récupération des credentials…')

    try {
      const tokenRes = await fetch('/api/avatar-token', { method: 'POST' })
      if (!tokenRes.ok) throw new Error(`avatar-token ${tokenRes.status}`)
      const { sessionToken, appId, avatarId } =
        await tokenRes.json() as { sessionToken: string; appId: string; avatarId: string }

      if (!AvatarSDK.isInitialized) {
        await AvatarSDK.initialize(appId, {
          environment:        Environment.intl,
          drivingServiceMode: DrivingServiceMode.sdk,
        })
      }
      AvatarSDK.setSessionToken(sessionToken)

      const container = containerRef.current
      if (!container) throw new Error('Container non prêt')

      setStatus('Chargement avatar…')
      const avatar = await AvatarManager.shared.load(avatarId)

      avatarViewRef.current?.dispose()
      avatarViewRef.current = new AvatarView(avatar, container)
      const ctrl = getController(avatarViewRef.current)

      // Garde locale — onConnectionState fire AVANT que ctrl.start() resolve
      let connectionSucceeded = false
      ctrl.onConnectionState = (state: string) => {
        if (state === 'connected') {
          connectionSucceeded = true
          setConnected(true)
          setStatus('Avatar connecté — cliquer "Test audio"')
          // Remplacer le handler pour surveiller les déconnexions futures
          ctrl.onConnectionState = (s: string) => {
            if (s === 'disconnected' || s === 'failed') {
              setConnected(false)
              setStatus(`Connexion perdue (${s}) — cliquer "Connecter avatar"`)
            }
          }
        } else if (state === 'failed') {
          setStatus(`Connexion échouée — vérifier SPATIALREAL_SESSION_TOKEN dans .env.local`)
        }
      }

      setStatus('Connexion SpatialReal…')
      await ctrl.initializeAudioContext()
      await ctrl.start()

      // ctrl.start() résout APRÈS que onConnectionState a fire
      if (!connectionSucceeded) {
        throw new Error('SpatialReal n\'a pas confirmé la connexion — token expiré ou invalide ?')
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erreur de connexion')
      setConnected(false)
    } finally {
      setConnecting(false)
    }
  }, [connecting, connected])

  const sendTestAudio = useCallback(async () => {
    if (sending || !connected || !avatarViewRef.current) return
    setSending(true)
    setStatus('Téléchargement audio demo…')
    try {
      const res = await fetch(DEMO_PCM_URL)
      if (!res.ok) throw new Error('Échec téléchargement audio')
      const buffer = await res.arrayBuffer()
      getController(avatarViewRef.current).send(buffer, true)
      setStatus(`Audio envoyé (${buffer.byteLength} bytes)`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erreur envoi audio')
    } finally {
      setSending(false)
    }
  }, [sending, connected])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f0f1a]">
      <div className="w-full max-w-2xl flex flex-col gap-3">

        {/* Container WebGL — le SDK injecte son canvas ici */}
        <div
          ref={containerRef}
          className="w-full overflow-hidden rounded-xl border border-white/10"
          style={{ aspectRatio: '16/10', minHeight: 320 }}
        />

        {/* Boutons */}
        <div className="flex gap-2 flex-wrap">
          <button
            disabled={connecting || connected}
            onClick={() => void connectAvatar()}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? 'Connexion…' : connected ? 'Avatar connecté' : 'Connecter avatar'}
          </button>

          <button
            disabled={sending || !connected}
            onClick={() => void sendTestAudio()}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Envoi…' : 'Test audio'}
          </button>
        </div>

        {/* Status */}
        <p className="text-sm text-white/40">{status}</p>

      </div>
    </div>
  )
}
