'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import AvatarSelector from './AvatarSelector'
import SceneEnvironment from './SceneEnvironment'

interface Props {
  characterName: string
}

export default function Experience({ characterName }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 3], fov: 45 }}
      shadows
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SceneEnvironment />
        <AvatarSelector characterName={characterName} />
        <ContactShadows
          position={[0, -0.75, 0]}
          opacity={0.45}
          scale={4}
          blur={2.5}
          far={1.5}
        />
        {/* Dev orbit controls — remove or lock when the real avatar is integrated */}
        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={6}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.8}
          target={[0, 0, 0]}
        />
      </Suspense>
    </Canvas>
  )
}
