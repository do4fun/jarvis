import SceneWrapper from '@/components/ui/SceneWrapper'
import ChatOverlay from '@/components/ui/ChatOverlay'

export default function Home() {
  const characterName = process.env.CARACTER_NAME ?? 'Jarvis'
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0f0f1a]">
      <SceneWrapper characterName={characterName} />
      <ChatOverlay characterName={characterName} />
    </main>
  )
}
