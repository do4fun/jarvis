// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat — Orchestrateur LLM + streaming AvatarKit
//
// Pipeline de latence minimale :
//   1. Enregistre un AbortController dans activeStreams (barge-in possible)
//   2. Stream Claude avec tool_use forcé → extraction token-par-token du champ "text"
//   3. Chaque token texte est :
//      a. Émis en SSE (text_delta) → affichage UI immédiat
//      b. Envoyé à AvatarKit text API → TTS démarre sans attendre la fin
//   4. À la fin du stream → flush AvatarKit + emit avatar_complete + done
//   5. Nettoie l'AbortController du registre
//
// Garantie barge-in : si AbortController.abort() est appelé pendant le stream,
// la boucle `for await` se termine proprement et AvatarKit reçoit un interrupt.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { anthropic, avatarTool, SYSTEM_PROMPT } from '@/lib/anthropic'
import { logger } from '@/lib/logger'
import { activeStreams } from '@/lib/activeStreams'
import type { AvatarResponse } from '@/types/avatar'
import type { ChatRequest, SSEEvent } from '@/types/api'
import { RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk'

const CTX = '/api/chat'

// ── Extracteur de champ "text" du JSON partiel ────────────────────────────────
// Machine à états qui parse le flux JSON partiel de l'outil Claude
// et extrait le champ "text" caractère par caractère.

class TextFieldExtractor {
  private buf = ''
  private phase: 'seeking' | 'in_value' | 'done' = 'seeking'
  private ptr = 0

  feed(delta: string): string {
    if (this.phase === 'done') return ''
    this.buf += delta

    if (this.phase === 'seeking') {
      const marker = '"text":"'
      const idx = this.buf.indexOf(marker)
      if (idx === -1) return ''
      this.ptr = idx + marker.length
      this.phase = 'in_value'
    }

    let out = ''
    while (this.ptr < this.buf.length) {
      const ch = this.buf[this.ptr]
      if (ch === '\\') {
        if (this.ptr + 1 >= this.buf.length) break
        const esc = this.buf[this.ptr + 1]
        out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc
        this.ptr += 2
      } else if (ch === '"') {
        this.phase = 'done'
        this.ptr++
        break
      } else {
        out += ch
        this.ptr++
      }
    }
    return out
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: ChatRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), { status: 400 })
  }

  if (!body.message?.trim()) {
    return new Response(JSON.stringify({ error: '"message" est requis' }), { status: 400 })
  }

  const { avatarSessionId } = body

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...(body.history ?? []).map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: body.message },
  ]

  logger.info(CTX, '→ REQUEST', {
    message:         body.message.slice(0, 120),
    history:         (body.history ?? []).length,
    avatarSessionId: avatarSessionId ?? 'none',
  })

  const encoder = new TextEncoder()
  const startMs = Date.now()

  // AbortController partagé avec le handler barge-in via activeStreams
  const abortController = new AbortController()
  if (avatarSessionId) {
    activeStreams.set(avatarSessionId, abortController)
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        const anthropicStream = anthropic.messages.stream(
          {
            model:       'claude-sonnet-4-6',
            max_tokens:  1024,
            system:      SYSTEM_PROMPT,
            tools:       [avatarTool],
            tool_choice: { type: 'any' },
            messages,
          },
          // Passe le signal d'abandon au SDK Anthropic
          { signal: abortController.signal },
        )

        const extractor  = new TextFieldExtractor()
        let   jsonBuffer = ''
        let   deltaCount = 0

        for await (const event of anthropicStream) {
          // Vérifier l'annulation à chaque itération (barge-in)
          if (abortController.signal.aborted) {
            logger.info(CTX, '⚡ stream annulé par barge-in')
            break
          }

          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'input_json_delta'
          ) {
            const delta = event.delta.partial_json
            jsonBuffer += delta
            deltaCount++

            const textChunk = extractor.feed(delta)
            if (textChunk) {
              // a. SSE → UI immédiat
              emit({ type: 'text_delta', content: textChunk })

            }
          }
        }

        // Si le stream a été annulé, ne pas émettre avatar_complete
        if (abortController.signal.aborted) {
          emit({ type: 'done' })
          return
        }

        if (!jsonBuffer) throw new Error('Claude a retourné un input outil vide.')

        const avatarResponse = JSON.parse(jsonBuffer) as AvatarResponse

        logger.info(CTX, '← AVATAR_COMPLETE', {
          animation:  avatarResponse.animation.name,
          emotion:    avatarResponse.emotion,
          text:       avatarResponse.text.slice(0, 120),
          deltas:     deltaCount,
          ms:         Date.now() - startMs,
        })

        emit({ type: 'avatar_complete', response: avatarResponse })
        emit({ type: 'done' })

        // Forwarder le texte à l'agent Python via LiveKit data channel
        // → agent.say() → Cartesia TTS → SpatialReal → lèvres animées
        const livekitUrl    = process.env.LIVEKIT_URL
        const livekitApiKey = process.env.LIVEKIT_API_KEY
        const livekitSecret = process.env.LIVEKIT_API_SECRET
        const room          = body.room ?? 'jarvis-room'
        if (livekitUrl && livekitApiKey && livekitSecret) {
          const httpUrl = livekitUrl.replace(/^wss?:\/\//, 'https://')
          const roomSvc = new RoomServiceClient(httpUrl, livekitApiKey, livekitSecret)
          const payload = new TextEncoder().encode(
            JSON.stringify({ type: 'jarvis_say', text: avatarResponse.text }),
          )
          roomSvc
            .sendData(room, payload, DataPacket_Kind.RELIABLE)
            .then(() => logger.info(CTX, '→ text forwarded to agent via LiveKit'))
            .catch((err: unknown) =>
              logger.warn(CTX, '⚠ LiveKit sendData failed (agent absent?)', { err: String(err) }),
            )
        }

        logger.info(CTX, `✓ terminé en ${Date.now() - startMs}ms`)
      } catch (err) {
        // Ne pas traiter l'AbortError comme une erreur utilisateur
        if (err instanceof Error && err.name === 'AbortError') {
          logger.info(CTX, '⚡ AbortError — barge-in confirmé')
          emit({ type: 'done' })
          return
        }
        const message = err instanceof Error ? err.message : String(err)
        logger.error(CTX, '✗ stream error', { message })
        emit({ type: 'error', message })
      } finally {
        // Nettoyer le registre — même en cas d'erreur ou d'annulation
        if (avatarSessionId) {
          activeStreams.delete(avatarSessionId)
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      Connection:          'keep-alive',
      'X-Accel-Buffering': 'no', // Désactive le buffering Nginx pour SSE
    },
  })
}
