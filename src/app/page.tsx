import dynamic from 'next/dynamic'

// JarvisAvatar utilise WebGL + LiveKit — désactiver le SSR
const JarvisAvatar = dynamic(() => import('@/components/JarvisAvatar'), { ssr: false })

export default function Home() {
  return <JarvisAvatar />
}
