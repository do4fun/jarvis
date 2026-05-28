import AvatarKitSection from '@/components/canvas/AvatarKitSection'
import ChatOverlay from '@/components/ui/ChatOverlay'

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0f0f1a]">
      <AvatarKitSection />
      <ChatOverlay />
    </main>
  )
}
