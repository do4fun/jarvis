// ─────────────────────────────────────────────────────────────────────────────
// POST /api/token — Génère un token LiveKit + dispatche l'agent vocal
//
// Flow :
//   1. Crée (ou rejoint) une room LiveKit
//   2. Génère un JWT d'accès pour le navigateur (1h de validité)
//   3. Dispatche le worker Python "jarvis-agent" dans la room
//   4. Retourne { token, url, room, identity }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk'
import { logger } from '@/lib/logger'

const CTX = '/api/token'

export async function POST(req: NextRequest) {
  const livekitUrl    = process.env.LIVEKIT_URL
  const livekitApiKey = process.env.LIVEKIT_API_KEY
  const livekitSecret = process.env.LIVEKIT_API_SECRET

  if (!livekitUrl || !livekitApiKey || !livekitSecret) {
    logger.error(CTX, '✗ Variables LiveKit manquantes (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET)')
    return NextResponse.json(
      { error: 'LiveKit non configuré — vérifier les variables d\'environnement' },
      { status: 500 },
    )
  }

  let body: { room?: string } = {}
  try {
    body = await req.json()
  } catch {
    // Corps vide ou non-JSON → utiliser les défauts
  }

  const room     = body.room ?? 'jarvis-room'
  const identity = `browser-${crypto.randomUUID().slice(0, 8)}`

  logger.info(CTX, '→ génération token', { room, identity })

  // ── 1. Générer le JWT LiveKit ─────────────────────────────────────────────
  const at = new AccessToken(livekitApiKey, livekitSecret, {
    identity,
    ttl: '1h',
  })
  at.addGrant({
    roomJoin:         true,
    room,
    canPublish:       true,   // micro utilisateur
    canSubscribe:     true,   // vidéo/audio avatar
    canPublishData:   true,
  })
  const token = await at.toJwt()

  // ── 2. Dispatcher l'agent Python dans la room ─────────────────────────────
  // L'agent "jarvis-agent" doit être enregistré côté serveur LiveKit Cloud.
  // Agent name correspond à WorkerOptions(agent_name=...) dans agent.py.
  try {
    const httpUrl = livekitUrl.replace(/^wss?:\/\//, 'https://')
    const dispatch = new AgentDispatchClient(httpUrl, livekitApiKey, livekitSecret)
    await dispatch.createDispatch(room, 'jarvis-agent')
    logger.info(CTX, '✓ agent dispatché', { room })
  } catch (err) {
    // Ne pas bloquer le client si le dispatch échoue (agent peut déjà être présent)
    logger.warn(CTX, '⚠ dispatch agent échoué (agent déjà présent?)', { err: String(err) })
  }

  logger.info(CTX, '✓ token généré', { room, identity })

  return NextResponse.json({
    token,
    url:      livekitUrl,
    room,
    identity,
  })
}
