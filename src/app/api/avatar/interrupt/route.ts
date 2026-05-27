// ─────────────────────────────────────────────────────────────────────────────
// POST /api/avatar/interrupt — Mécanisme de barge-in (interruption immédiate)
//
// Appelé quand l'utilisateur commence à parler pendant que l'avatar s'exprime.
// Deux actions simultanées :
//   1. Annule le stream Claude en cours via AbortController (activeStreams map)
//   2. Appelle l'API AvatarKit interrupt → avatar silencieux en <1 frame vidéo
//
// Optimisation latence : les deux annulations sont lancées en parallèle
// via Promise.allSettled() — pas d'attente séquentielle.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { interruptSession } from '@/lib/avatarkit'
import { activeStreams } from '@/lib/activeStreams'
import { logger } from '@/lib/logger'

const CTX = '/api/avatar/interrupt'

interface InterruptBody {
  avatarSessionId: string
}

export async function POST(req: NextRequest) {
  let body: InterruptBody

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  if (!body.avatarSessionId) {
    return NextResponse.json({ error: '"avatarSessionId" est requis' }, { status: 400 })
  }

  const { avatarSessionId } = body
  logger.info(CTX, '⚡ barge-in reçu', { avatarSessionId })

  // Annuler le stream Claude en cours (si actif)
  const controller = activeStreams.get(avatarSessionId)
  if (controller) {
    controller.abort('barge-in')
    activeStreams.delete(avatarSessionId)
    logger.info(CTX, '✓ stream Claude annulé')
  }

  // Interrompre l'avatar en parallèle (fire-and-forget si stream déjà annulé)
  const [interruptResult] = await Promise.allSettled([
    interruptSession({ sessionId: avatarSessionId }),
  ])

  if (interruptResult.status === 'rejected') {
    logger.error(CTX, '✗ interrupt AvatarKit échoué', {
      error: String(interruptResult.reason),
    })
    // On ne retourne pas d'erreur — le stream Claude est déjà annulé
  }

  return NextResponse.json({ ok: true })
}
