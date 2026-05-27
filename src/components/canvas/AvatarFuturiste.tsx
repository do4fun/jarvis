'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAvatarStore } from '@/store/useAvatarStore'
import { analyserSingleton } from '@/lib/analyserSingleton'
import type { AnimationName, EmotionName } from '@/types/avatar'

// ── Emotion base colours ──────────────────────────────────────────────────────
// Each emotion has two tones: dim (outer rings) and bright (inner ring).

const EMOTION_DIM: Record<EmotionName, string> = {
  neutral:   '#0a4a6a',
  happy:     '#0a5a30',
  sad:       '#0a2a70',
  angry:     '#5a0a18',
  surprised: '#5a3000',
  curious:   '#30086a',
  excited:   '#5a4a00',
  confused:  '#4a0838',
}
const EMOTION_BRIGHT: Record<EmotionName, string> = {
  neutral:   '#00ccee',
  happy:     '#00ee88',
  sad:       '#3388ff',
  angry:     '#ff2244',
  surprised: '#ff7700',
  curious:   '#9933ff',
  excited:   '#ffcc00',
  confused:  '#ff33aa',
}

// ── Amplitude helper ──────────────────────────────────────────────────────────

const _buf = new Uint8Array(128) as Uint8Array<ArrayBuffer>
function getRMS(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
  return Math.sqrt(sum / buf.length)
}

// ── Material factory ──────────────────────────────────────────────────────────
// AdditiveBlending: colours ADD together → soft, glowing edges without bloom.

function glowMat(hex: string, emissive: number, opacity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: emissive,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    roughness: 0,
    metalness: 0,
  })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props { characterName?: string }

// ── AvatarFuturiste ───────────────────────────────────────────────────────────

export default function AvatarFuturiste({ characterName: _characterName = 'Futuriste' }: Props) {
  const groupRef = useRef<THREE.Group>(null!)
  const rA = useRef<THREE.Group>(null!)   // outer ticks     CW slow
  const rB = useRef<THREE.Group>(null!)   // large arcs      CCW med
  const rC = useRef<THREE.Group>(null!)   // dashes          CW med
  const rD = useRef<THREE.Group>(null!)   // inner segs      CCW fast
  const lightRef = useRef<THREE.PointLight>(null!)

  const jawRef = useRef(0)
  const tRef   = useRef(0)
  const dim    = useRef(new THREE.Color())
  const bright = useRef(new THREE.Color())

  // ── Materials — gradient from dim outer to bright inner ───────────────────
  // Outer zone (A, B): dim blue, low opacity
  const matA  = useMemo(() => glowMat('#0a4060',  2.0, 0.30), []) // ticks — very pale
  const matB  = useMemo(() => glowMat('#0d5a78',  2.5, 0.48), []) // large arcs — dim
  const matBs = useMemo(() => glowMat('#0a4a66',  1.8, 0.28), []) // small arcs — paler still

  // Middle zone (C): medium blue-cyan
  const matC  = useMemo(() => glowMat('#0a7090',  3.0, 0.55), []) // dashes

  // Inner zone (D): cyan, noticeably brighter
  const matD  = useMemo(() => glowMat('#00a0c0',  3.5, 0.70), []) // segments

  // Bright ring (E): cyan — same colour family as other rings, but brighter.
  // emissiveIntensity stays ≤ 4 to avoid washing out to white.
  // Halo layers use AdditiveBlending + large tubes to bleed outward.
  const matE0 = useMemo(() => glowMat('#00ccee',  3.5, 0.82), []) // core ring
  const matE1 = useMemo(() => glowMat('#00aadd',  2.5, 0.55), []) // halo 1
  const matE2 = useMemo(() => glowMat('#0088bb',  1.5, 0.35), []) // halo 2
  const matE3 = useMemo(() => glowMat('#006699',  0.8, 0.18), []) // halo 3
  const matE4 = useMemo(() => glowMat('#004477',  0.4, 0.08), []) // halo 4 — widest

  // Accent ring (F): thin inner ring, medium
  const matF  = useMemo(() => glowMat('#0099bb',  2.5, 0.45), [])

  // All materials that change colour with emotion (grouped by zone)
  const outerMats  = useMemo(() => [matA, matB, matBs],         [matA, matB, matBs])
  const midMats    = useMemo(() => [matC],                       [matC])
  const innerMats  = useMemo(() => [matD, matF],                 [matD, matF])
  const brightMats = useMemo(() => [matE0, matE1, matE2, matE3, matE4], [matE0, matE1, matE2, matE3, matE4])

  // ── Geometries ────────────────────────────────────────────────────────────

  // Outer tick ring — 120 thin boxes at r = 1.08
  const tickMesh = useMemo(() => {
    const geo  = new THREE.BoxGeometry(0.004, 0.018, 0.001)
    const mesh = new THREE.InstancedMesh(geo, matA, 120)
    const d    = new THREE.Object3D()
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2
      d.position.set(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0)
      d.rotation.z = a; d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }, [matA])

  // Outer thin full circle r = 1.0
  const outerCircleGeo = useMemo(() => new THREE.TorusGeometry(1.0, 0.0025, 6, 120), [])

  // Ring B data — 8 alternating large / small arcs at r = 0.96
  const arcsBData = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      startAngle: (i / 8) * Math.PI * 2,
      arc:  (Math.PI * 2 / 8) * (i % 2 === 0 ? 0.68 : 0.13),
      large: i % 2 === 0,
    })), [])

  // Ring C data — 28 dashes at r = 0.84
  const arcsCData = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      startAngle: (i / 28) * Math.PI * 2,
      arc: (Math.PI * 2 / 28) * 0.46,
    })), [])

  // Ring D data — 16 varied segments at r = 0.72
  const arcsDData = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      startAngle: (i / 16) * Math.PI * 2,
      arc: (Math.PI * 2 / 16) * (i % 5 === 0 ? 0.12 : i % 3 === 0 ? 0.07 : 0.52),
    })), [])

  // Small rectangular blocks on ring D — 8 instanced boxes
  const blockMesh = useMemo(() => {
    const geo  = new THREE.BoxGeometry(0.022, 0.012, 0.001)
    const mesh = new THREE.InstancedMesh(geo, matD, 8)
    const d    = new THREE.Object3D()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.15
      d.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0)
      d.rotation.z = a; d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }, [matD])

  // Bright ring E — core + 4 halo layers with progressively wider tubes
  const geoE0 = useMemo(() => new THREE.TorusGeometry(0.600, 0.018, 16, 100), [])
  const geoE1 = useMemo(() => new THREE.TorusGeometry(0.600, 0.050, 12, 100), [])
  const geoE2 = useMemo(() => new THREE.TorusGeometry(0.600, 0.090, 10, 100), [])
  const geoE3 = useMemo(() => new THREE.TorusGeometry(0.600, 0.140, 8,  100), [])
  const geoE4 = useMemo(() => new THREE.TorusGeometry(0.600, 0.210, 6,  100), [])

  // Thin inner accent ring r = 0.52
  const innerThinGeo = useMemo(() => new THREE.TorusGeometry(0.52, 0.003, 6, 80), [])

  // ── Frame loop ────────────────────────────────────────────────────────────
  useFrame((_, dt) => {
    const { animation, emotion, isSpeaking } = useAvatarStore.getState()
    tRef.current += dt
    const t = tRef.current

    // Resolve emotion colours
    dim.current.set(EMOTION_DIM[emotion]    ?? EMOTION_DIM.neutral)
    bright.current.set(EMOTION_BRIGHT[emotion] ?? EMOTION_BRIGHT.neutral)
    const d = dim.current
    const b = bright.current

    // Outer zone — dim colour, keep low emissive
    for (const m of outerMats)  { m.color.set(d); m.emissive.set(d) }
    // Mid zone — interpolate between dim and bright
    for (const m of midMats)    { m.color.set(d); m.emissive.set(d) }
    // Inner zone — bright colour
    for (const m of innerMats)  { m.color.set(b); m.emissive.set(b) }
    // Bright ring — full bright colour
    for (const m of brightMats) { m.color.set(b); m.emissive.set(b) }
    if (lightRef.current) lightRef.current.color.set(b)

    // Ring rotations
    if (rA.current) rA.current.rotation.z += dt * 0.12
    if (rB.current) rB.current.rotation.z -= dt * 0.22
    if (rC.current) rC.current.rotation.z += dt * 0.38
    if (rD.current) rD.current.rotation.z -= dt * 0.56

    // Lip-sync — expand halo opacity + emissive on bright ring
    const analyser = analyserSingleton.node
    const raw = analyser && isSpeaking ? getRMS(analyser, _buf) : 0
    jawRef.current += (raw - jawRef.current) * 0.3
    const jaw = jawRef.current

    matE0.emissiveIntensity = 3.5 + jaw * 4  + Math.sin(t * 5) * 0.3
    matE1.opacity           = 0.55 + jaw * 0.30
    matE2.opacity           = 0.35 + jaw * 0.25
    matE3.opacity           = 0.18 + jaw * 0.20
    matE4.opacity           = 0.08 + jaw * 0.15
    if (lightRef.current) lightRef.current.intensity = 1.5 + jaw * 5

    // ── Body animations ────────────────────────────────────────────────────
    if (!groupRef.current) return
    const g = groupRef.current
    switch (animation.name as AnimationName) {
      case 'idle':
        g.position.set(0, Math.sin(t * 0.8) * 0.035, 0)
        g.rotation.set(0, Math.sin(t * 0.3) * 0.04, 0)
        g.scale.setScalar(1)
        break
      case 'talking':
        g.position.set(0, Math.sin(t * 1.2) * 0.02, 0)
        g.rotation.set(0, Math.sin(t * 0.5) * 0.03, 0)
        g.scale.setScalar(1)
        break
      case 'thinking':
        g.position.set(0, Math.sin(t * 0.5) * 0.02, 0)
        g.rotation.z += dt * 0.35
        break
      case 'nodding':
        g.position.set(0, 0, 0)
        g.rotation.set(Math.sin(t * 4) * 0.14, 0, 0)
        g.scale.setScalar(1)
        break
      case 'waving':
        g.position.set(Math.sin(t * 3) * 0.15, Math.sin(t) * 0.04, 0)
        g.rotation.set(0, Math.sin(t * 3) * 0.10, 0)
        g.scale.setScalar(1)
        break
      case 'surprised':
        g.position.set(0, 0, 0)
        g.rotation.set(0, 0, 0)
        g.scale.setScalar(1 + Math.max(0, Math.sin(t * 6)) * 0.09)
        break
      case 'shaking_head':
        g.position.set(0, 0, 0)
        g.rotation.set(0, Math.sin(t * 6) * 0.22, 0)
        g.scale.setScalar(1)
        break
      default:
        g.position.set(0, 0, 0)
        g.rotation.set(0, 0, 0)
        g.scale.setScalar(1)
    }
  })

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <group ref={groupRef}>
      {/* Point light — bright colour, pulses with lip-sync */}
      <pointLight ref={lightRef} color="#00ccee" intensity={1.5} distance={6} />

      {/* ── Ring A: outer tick marks + thin full circle ── */}
      <group ref={rA}>
        <primitive object={tickMesh} />
        <mesh geometry={outerCircleGeo} material={matA} />
      </group>

      {/* ── Ring B: alternating large / small arc segments ── */}
      <group ref={rB}>
        {arcsBData.map(({ startAngle, arc, large }, i) => (
          <mesh key={i} rotation={[0, 0, startAngle]} material={large ? matB : matBs}>
            <torusGeometry args={[0.96, large ? 0.013 : 0.006, 6, large ? 50 : 20, arc]} />
          </mesh>
        ))}
      </group>

      {/* ── Ring C: uniform dashes ── */}
      <group ref={rC}>
        {arcsCData.map(({ startAngle, arc }, i) => (
          <mesh key={i} rotation={[0, 0, startAngle]} material={matC}>
            <torusGeometry args={[0.84, 0.007, 6, 18, arc]} />
          </mesh>
        ))}
      </group>

      {/* ── Ring D: varied segments + small blocks ── */}
      <group ref={rD}>
        {arcsDData.map(({ startAngle, arc }, i) => (
          <mesh key={i} rotation={[0, 0, startAngle]} material={matD}>
            <torusGeometry args={[0.72, 0.010, 6, 22, arc]} />
          </mesh>
        ))}
        <primitive object={blockMesh} />
      </group>

      {/* ── Ring E: core + 4 halo layers — tubes widen outward for bleed ── */}
      <mesh geometry={geoE0} material={matE0} />
      <mesh geometry={geoE1} material={matE1} />
      <mesh geometry={geoE2} material={matE2} />
      <mesh geometry={geoE3} material={matE3} />
      <mesh geometry={geoE4} material={matE4} />

      {/* ── Ring F: thin inner accent ring ── */}
      <mesh geometry={innerThinGeo} material={matF} />
    </group>
  )
}
