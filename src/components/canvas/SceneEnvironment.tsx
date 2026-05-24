'use client'

import { Environment } from '@react-three/drei'
import { useAvatarStore } from '@/store/useAvatarStore'
import type { EnvironmentPreset } from '@/types/avatar'

// Map our preset names to @react-three/drei built-in HDR presets
const DREI_PRESET: Record<EnvironmentPreset, string> = {
  default:   'studio',
  studio:    'studio',
  night:     'night',
  office:    'city',
  outdoor:   'park',
  warehouse: 'warehouse',
}

const DEFAULT_BG            = '#0f0f1a'
const DEFAULT_AMBIENT       = 0.4
const DEFAULT_FILL_INTENSITY = 0.3

export default function SceneEnvironment() {
  const environment = useAvatarStore((s) => s.environment)

  const preset          = DREI_PRESET[environment?.preset ?? 'default']
  const ambientIntensity = environment?.ambientIntensity ?? DEFAULT_AMBIENT
  const bg              = environment?.backgroundColor   ?? DEFAULT_BG

  return (
    <>
      {/* Declarative background colour — reacts to store without useEffect */}
      <color attach="background" args={[bg]} />

      {/* Key light */}
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {/* Cool fill light */}
      <directionalLight
        position={[-5, 3, -5]}
        intensity={DEFAULT_FILL_INTENSITY}
        color="#8888ff"
      />

      {/* Image-based lighting — background={false} keeps our colour above */}
      <Environment preset={preset as 'studio'} background={false} />
    </>
  )
}
