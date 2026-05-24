import dynamic from 'next/dynamic'
import ChatOverlay from '@/components/ui/ChatOverlay'

// Three.js / WebGL requires browser APIs — disable SSR on the Canvas
const Experience = dynamic(() => import('@/components/canvas/Experience'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#0f0f1a]">
      <p className="font-mono text-sm text-white/30">Initialisation…</p>
    </div>
  ),
})

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0f0f1a]">
      {/* 3D Canvas — fills the entire viewport */}
      <div className="absolute inset-0">
        <Experience />
      </div>

      {/* UI overlay — pointer-events managed per-child inside the component */}
      <ChatOverlay />
    </main>
  )
}
