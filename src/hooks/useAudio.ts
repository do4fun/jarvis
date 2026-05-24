'use client'

import { useRef, useCallback, useEffect } from 'react'
import { useAvatarStore } from '@/store/useAvatarStore'
import { analyserSingleton } from '@/lib/analyserSingleton'

export interface AudioController {
  /** Decode and play an ArrayBuffer. Resolves when playback finishes. */
  play: (arrayBuffer: ArrayBuffer) => Promise<void>
  /** Immediately stop current playback. */
  stop: () => void
  /**
   * AnalyserNode reference — available after the first play() call.
   * Use in useFrame to sample amplitude for lip-sync:
   *   analyserNode.current?.getByteTimeDomainData(dataArray)
   */
  analyserNode: React.RefObject<AnalyserNode | null>
}

export function useAudio(): AudioController {
  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef   = useRef<AudioBufferSourceNode | null>(null)

  const { setSpeaking } = useAvatarStore()

  // Lazily create AudioContext on first user gesture (browser autoplay policy).
  // Safe to call multiple times — returns the existing instance.
  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()

      const analyser = ctxRef.current.createAnalyser()
      analyser.fftSize = 256 // 128 frequency bins, sufficient for amplitude lip-sync
      analyser.connect(ctxRef.current.destination)
      analyserRef.current = analyser
      analyserSingleton.node = analyser // expose to Avatar useFrame
    }

    // Resume if suspended by the browser's autoplay policy
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }

    return ctxRef.current
  }, [])

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop()
    } catch {
      // Ignore "already stopped" errors
    }
    sourceRef.current = null
    setSpeaking(false)
  }, [setSpeaking])

  const play = useCallback(
    (arrayBuffer: ArrayBuffer): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        try {
          const ctx = getCtx()
          stop() // Abort any ongoing playback

          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
          const source = ctx.createBufferSource()
          source.buffer = audioBuffer

          // Audio graph: source → analyser → speakers
          source.connect(analyserRef.current!)

          source.onended = () => {
            setSpeaking(false)
            sourceRef.current = null
            resolve()
          }

          sourceRef.current = source
          setSpeaking(true)
          source.start(0)
        } catch (err) {
          setSpeaking(false)
          reject(err)
        }
      })
    },
    [getCtx, stop, setSpeaking],
  )

  // Cleanup AudioContext on component unmount
  useEffect(() => {
    return () => {
      stop()
      ctxRef.current?.close()
      ctxRef.current = null
      analyserSingleton.node = null
    }
  }, [stop])

  return { play, stop, analyserNode: analyserRef }
}
