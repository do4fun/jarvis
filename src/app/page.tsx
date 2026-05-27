import AvatarKitSection from '@/components/canvas/AvatarKitSection'
import ChatOverlay from '@/components/ui/ChatOverlay'

/**
 * Page principale Jarvis — Architecture WebRTC
 *
 * Structure :
 *   ┌────────────────────────────────────┐
 *   │  AvatarKitSection                  │  ← vidéo WebRTC plein écran
 *   │  (AvatarKitPlayer + init session)  │    rendu côté serveur SpatialReal
 *   │                                    │
 *   │  ┌──────────────────────────────┐  │
 *   │  │  ChatOverlay (UI texte)      │  │  ← superposé, pointer-events sélectifs
 *   │  └──────────────────────────────┘  │
 *   └────────────────────────────────────┘
 */
export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0f0f1a]">
      {/* Flux vidéo WebRTC AvatarKit — charge GPU nulle côté client */}
      <AvatarKitSection />

      {/* Interface chat superposée — interactif seulement sur les zones UI */}
      <ChatOverlay />
    </main>
  )
}
