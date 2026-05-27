// ─────────────────────────────────────────────────────────────────────────────
// POST /api/avatar/ice — Échange de signalisation WebRTC (SDP answer + ICE)
//
// Deux opérations supportées dans le même endpoint :
//   1. sdpAnswer  → soumet la réponse SDP du navigateur à AvatarKit
//   2. candidate  → transmet un candidat ICE (trickle ICE)
//
// Optimisation latence : trickle ICE permet d'envoyer les candidats dès
// leur génération sans attendre la liste complète — connexion établie
// en parallèle de la collecte des autres candidats.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { submitSdpAnswer, addIceCandidate } from '@/lib/avatarkit'
import { logger } from '@/lib/logger'
import type { AvatarKitSdpAnswer, AvatarKitIceCandidate } from '@/types/avatarkit'

const CTX = '/api/avatar/ice'

type IceBody =
  | (AvatarKitSdpAnswer & { kind: 'sdpAnswer' })
  | (AvatarKitIceCandidate & { kind: 'iceCandidate' })

export async function POST(req: NextRequest) {
  let body: IceBody

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: '"sessionId" est requis' }, { status: 400 })
  }

  try {
    if (body.kind === 'sdpAnswer') {
      logger.info(CTX, '→ SDP answer', { sessionId: body.sessionId })
      await submitSdpAnswer({ sessionId: body.sessionId, sdpAnswer: body.sdpAnswer })
      logger.info(CTX, '✓ SDP answer acceptée')
    } else if (body.kind === 'iceCandidate') {
      // Trickle ICE — pas de log pour chaque candidat (trop verbeux)
      await addIceCandidate({ sessionId: body.sessionId, candidate: body.candidate })
    } else {
      return NextResponse.json(
        { error: '"kind" doit être "sdpAnswer" ou "iceCandidate"' },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(CTX, '✗ ICE signaling error', { message, sessionId: body.sessionId })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
