'use client'

import dynamic from 'next/dynamic'
import { useAvatarStore } from '@/store/useAvatarStore'

const AvatarKitPlayer = dynamic(() => import('./AvatarKitPlayer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0f0f1a] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
    </div>
  ),
})

export default function AvatarKitSection() {
  const { setSpeak } = useAvatarStore()

  return (
    <AvatarKitPlayer
      className="h-full w-full"
      onReady={setSpeak}
    />
  )
}
