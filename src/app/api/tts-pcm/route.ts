import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

const CTX = '/api/tts-pcm'

// Retourne du PCM 16kHz 16-bit mono signé (audio/pcm) via ElevenLabs.
// C'est le format exact attendu par AvatarView.controller.send(audioData, true).
export async function POST(req: NextRequest) {
  let body: { text: string; voiceId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return new Response(JSON.stringify({ error: '"text" requis' }), { status: 400 })
  }

  const apiKey  = process.env.ELEVENLABS_API_KEY
  const voiceId = body.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'

  if (!apiKey) {
    logger.error(CTX, '✗ ELEVENLABS_API_KEY non configuré')
    return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY manquant' }), { status: 500 })
  }

  logger.info(CTX, '→ TTS PCM', { chars: text.length, voiceId })
  const startMs = Date.now()

  // output_format=pcm_16000 → raw PCM signed 16-bit LE, 16 kHz, mono
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_16000`,
    {
      method: 'POST',
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability:         0.5,
          similarity_boost:  0.75,
          style:             0.0,
          use_speaker_boost: true,
        },
      }),
    },
  )

  if (!upstream.ok) {
    const detail = await upstream.text()
    logger.error(CTX, `✗ ElevenLabs ${upstream.status}`, { detail: detail.slice(0, 200) })
    return new Response(
      JSON.stringify({ error: `ElevenLabs error ${upstream.status}`, detail }),
      { status: upstream.status },
    )
  }

  logger.info(CTX, `✓ PCM ready in ${Date.now() - startMs}ms`)

  return new Response(upstream.body, {
    headers: {
      'Content-Type':      'audio/pcm',
      'Cache-Control':     'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
