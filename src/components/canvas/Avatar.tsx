'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type Mesh } from 'three'
import { useAvatarStore } from '@/store/useAvatarStore'
import { analyserSingleton } from '@/lib/analyserSingleton'
import type { AnimationName, EmotionName } from '@/types/avatar'

// ── Emotion → mesh colour ─────────────────────────────────────────────────────

const EMOTION_COLOR: Record<EmotionName, string> = {
  neutral:   '#4f46e5',
  happy:     '#22c55e',
  sad:       '#3b82f6',
  angry:     '#ef4444',
  surprised: '#f59e0b',
  curious:   '#8b5cf6',
  excited:   '#f97316',
  confused:  '#6b7280',
}

// ── Body animation — all transforms set explicitly per case ───────────────────

function applyAnimation(name: AnimationName, mesh: Mesh, t: number, dt: number) {
  switch (name) {
    case 'idle':
      mesh.position.set(0, Math.sin(t * 0.8) * 0.06, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.setScalar(1)
      break
    case 'talking':
      mesh.position.set(0, Math.sin(t * 0.8) * 0.02, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.setScalar(1 + Math.sin(t * 10) * 0.025)
      break
    case 'nodding':
      mesh.position.set(0, 0, 0)
      mesh.rotation.set(Math.sin(t * 5) * 0.2, 0, 0)
      mesh.scale.setScalar(1)
      break
    case 'thinking':
      mesh.position.set(0, Math.sin(t * 0.5) * 0.03, 0)
      mesh.rotation.y += dt * 0.8 // accumulated — intentionally not reset
      mesh.rotation.x = 0
      mesh.scale.setScalar(1)
      break
    case 'waving':
      mesh.position.set(Math.sin(t * 3) * 0.15, Math.sin(t * 0.8) * 0.04, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.setScalar(1)
      break
    case 'surprised':
      mesh.position.set(0, Math.abs(Math.sin(t * 2)) * 0.05, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.setScalar(1 + Math.abs(Math.sin(t * 12)) * 0.12)
      break
    case 'shaking_head':
      mesh.position.set(0, 0, 0)
      mesh.rotation.set(0, Math.sin(t * 8) * 0.3, 0)
      mesh.scale.setScalar(1)
      break
    default:
      mesh.position.set(0, 0, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.setScalar(1)
  }
}

// ── Amplitude sampling ────────────────────────────────────────────────────────

/**
 * Returns a normalised RMS amplitude in [0, 1] from the time-domain waveform.
 * The buffer is passed in to avoid a new allocation every frame.
 */
function getRMSAmplitude(analyser: AnalyserNode, buffer: Uint8Array): number {
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const centered = buffer[i] - 128 // centre on zero
    sum += centered * centered
  }
  return Math.sqrt(sum / buffer.length) / 128 // normalise to [0, 1]
}

// ── Avatar ────────────────────────────────────────────────────────────────────
//
// PLACEHOLDER — sphere that reacts to store state.
// When replacing with a real GLB:
//   const { scene, animations } = useGLTF('/models/avatar.glb')
//   <primitive object={scene} ref={meshRef} />
// Lip-sync becomes:
//   const jawIdx = mesh.morphTargetDictionary?.['jawOpen']
//   if (jawIdx !== undefined) mesh.morphTargetInfluences![jawIdx] = smoothedJaw

export default function Avatar() {
  const meshRef    = useRef<Mesh>(null)
  const jawRef     = useRef(0)              // smoothed jaw amplitude (0–1)
  const audioData  = useRef<Uint8Array | null>(null) // reused buffer, no GC per frame

  // Subscribe to emotion for material colour (triggers React re-render)
  const emotion = useAvatarStore((s) => s.emotion)

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    // ── 1. Body animation ─────────────────────────────────────────────────────
    const { animation } = useAvatarStore.getState()
    applyAnimation(animation.name, mesh, clock.elapsedTime, delta)

    // ── 2. Lip-sync via amplitude ─────────────────────────────────────────────
    const analyser = analyserSingleton.node

    if (analyser) {
      // Lazily allocate the buffer once (frequencyBinCount = fftSize / 2 = 128)
      if (!audioData.current || audioData.current.length !== analyser.frequencyBinCount) {
        audioData.current = new Uint8Array(analyser.frequencyBinCount)
      }

      const raw = getRMSAmplitude(analyser, audioData.current)

      // Low-pass filter: lerp toward raw amplitude (0.3 = responsive, not jittery)
      jawRef.current += (raw - jawRef.current) * 0.3
    } else {
      // No audio — decay jaw back to closed
      jawRef.current += (0 - jawRef.current) * 0.15
    }

    const jaw = jawRef.current

    // ── Sphere proxy: squash Y-axis to simulate mouth opening ────────────────
    // Real GLB equivalent (uncomment when avatar is loaded):
    //   const jawIdx = mesh.morphTargetDictionary?.['jawOpen']
    //   if (jawIdx !== undefined && mesh.morphTargetInfluences) {
    //     mesh.morphTargetInfluences[jawIdx] = Math.min(jaw * 2.5, 1)
    //   }
    if (jaw > 0.005) {
      mesh.scale.y *= 1 + jaw * 2.5
    }
  })

  const color = new Color(EMOTION_COLOR[emotion])

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[0.5, 64, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.25}
        metalness={0.15}
      />
    </mesh>
  )
}
