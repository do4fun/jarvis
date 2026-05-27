// ─────────────────────────────────────────────────────────────────────────────
// POST /api/avatar/session — Création de session WebRTC AvatarKit
//
// 1. Appel serveur → API SpatialReal pour créer une session de rendu
// 2. Retourne l'offre SDP + serveurs ICE au client
// 3. Le client crée son RTCPeerConnection et répond via /api/avatar/ice
//
// Sécurité : AVATARKIT_API_KEY n'est jamais exposée au navigateur.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/avatarkit'
import { logger } from '@/lib/logger'
import type { AvatarKitSessionConfig } from '@/types/avatarkit'

const CTX = '/api/avatar/session'

export async function POST(req: NextRequest) {
  let config: AvatarKitSessionConfig

  try {
    config = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!config.avatarId) {
    return NextResponse.json({ error: '"avatarId" est requis' }, { status: 400 })
  }

  logger.info(CTX, '→ création session', { avatarId: config.avatarId })

  try {
    const session = await createSession({
      avatarId: config.avatarId,
      quality:  config.quality ?? 'medium',
      language: config.language ?? 'fr-FR',
      voiceId:  config.voiceId ?? process.env.AVATARKIT_VOICE_ID,
    })

    logger.info(CTX, '← session créée', { sessionId: session.sessionId })

    return NextResponse.json(session, {
      headers: {
        // Pas de cache — chaque session est unique
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(CTX, '✗ échec création session', { message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
