'use client'

import dynamic from 'next/dynamic'

// dynamic({ ssr: false }) must live inside a Client Component in Next.js App Router.
// This wrapper is that boundary — page.tsx (Server Component) imports this.
const Experience = dynamic(() => import('@/components/canvas/Experience'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#0f0f1a]">
      <p className="font-mono text-sm text-white/30">Initialisation…</p>
    </div>
  ),
})

export default function SceneWrapper() {
  return (
    <div className="absolute inset-0">
      <Experience />
    </div>
  )
}
