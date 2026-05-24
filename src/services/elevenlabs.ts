/**
 * Fetch synthesized speech from the /api/tts proxy route.
 * Returns an ArrayBuffer ready to be decoded by AudioContext.decodeAudioData().
 */
export async function fetchTTS(text: string, voiceId?: string): Promise<ArrayBuffer> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  })

  if (!res.ok) {
    let message = `TTS error ${res.status}`
    try {
      const json = await res.json()
      message = json.error ?? message
    } catch {
      // Non-JSON error body — keep the generic message
    }
    throw new Error(message)
  }

  return res.arrayBuffer()
}
