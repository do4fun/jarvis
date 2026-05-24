import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

const CTX           = '/api/tts'
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

interface TTSRequest {
  text: string
  voiceId?: string
}

export async function POST(req: NextRequest) {
  let body: TTSRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  if (!body.text?.trim()) {
    return new Response(JSON.stringify({ error: '"text" is required' }), { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    logger.error(CTX, '✗ ELEVENLABS_API_KEY not configured')
    return new Response(
      JSON.stringify({ error: 'ELEVENLABS_API_KEY is not configured' }),
      { status: 500 },
    )
  }

  const voiceId = body.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'

  logger.info(CTX, '→ REQUEST', {
    text:    body.text.slice(0, 80) + (body.text.length > 80 ? '…' : ''),
    chars:   body.text.length,
    voiceId,
  })

  const startMs = Date.now()

  const upstream = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
        Accept:         'audio/mpeg',
      },
      body: JSON.stringify({
        text: body.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability:        0.5,
          similarity_boost: 0.75,
          style:            0.0,
          use_speaker_boost: true,
        },
      }),
    },
  )

  if (!upstream.ok) {
    const detail = await upstream.text()
    logger.error(CTX, `✗ ElevenLabs error ${upstream.status}`, { detail: detail.slice(0, 200) })
    return new Response(
      JSON.stringify({ error: `ElevenLabs error ${upstream.status}`, detail }),
      { status: upstream.status },
    )
  }

  logger.info(CTX, `✓ streaming audio in ${Date.now() - startMs}ms`, {
    status:      upstream.status,
    contentType: upstream.headers.get('content-type'),
  })

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
