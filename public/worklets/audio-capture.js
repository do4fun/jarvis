// ─────────────────────────────────────────────────────────────────────────────
// AudioWorklet : audio-capture
//
// Capture l'audio du microphone et le convertit de Float32 en PCM16
// directement dans le thread audio (AudioWorkletGlobalScope).
//
// Optimisation latence :
//   - Le traitement s'effectue dans le thread dédié au rendu audio (non bloquant)
//   - Chunks de 128 samples @ 16kHz = ~8ms de latence par frame
//   - Pas d'encodage mp3/opus → zéro latence de codec
//   - Transfert sans copie via SharedArrayBuffer/Transferable
// ─────────────────────────────────────────────────────────────────────────────

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // Activation/désactivation du streaming (via port.postMessage)
    this._active = true
    this.port.onmessage = (e) => {
      if (e.data === 'stop') this._active = false
      if (e.data === 'start') this._active = true
    }
  }

  /**
   * process() est appelé toutes les 128 samples (~8ms @ 16kHz).
   * Convertit Float32 [-1, 1] → Int16 [-32768, 32767] et envoie le buffer
   * au thread principal via un transfert (zéro copie).
   */
  process(inputs) {
    if (!this._active) return true

    const input = inputs[0]
    if (!input || !input[0] || input[0].length === 0) return true

    const float32 = input[0] // Canal mono (downmixé par le navigateur)
    const int16   = new Int16Array(float32.length)

    for (let i = 0; i < float32.length; i++) {
      // Clamp puis conversion
      const clamped = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767
    }

    // Transfert sans copie → latence minimale
    this.port.postMessage(int16.buffer, [int16.buffer])
    return true // Continuer le processing
  }
}

registerProcessor('audio-capture', AudioCaptureProcessor)
