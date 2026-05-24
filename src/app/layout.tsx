import type { Metadata } from 'next'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const name = process.env.CARACTER_NAME ?? 'Jarvis'
  return {
    title: `${name} — Virtual Assistant`,
    description: 'AI-powered 3D virtual assistant',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
