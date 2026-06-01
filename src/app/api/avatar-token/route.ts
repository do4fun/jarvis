import { NextResponse } from 'next/server'

// Retourne les credentials SpatialReal pour le mode SDK côté client.
// Le session token ne doit pas être dans NEXT_PUBLIC_* pour éviter de l'exposer
// dans le bundle JS. Il est fourni ici par le serveur uniquement.
export async function POST() {
  const sessionToken = process.env.SPATIALREAL_SESSION_TOKEN ?? process.env.SPATIALREAL_API_KEY
  const appId        = process.env.NEXT_PUBLIC_SPATIALREAL_APP_ID
  const avatarId     = process.env.NEXT_PUBLIC_AVATARKIT_AVATAR_ID

  if (!sessionToken || !appId || !avatarId) {
    return NextResponse.json(
      { error: 'SpatialReal non configuré (SPATIALREAL_SESSION_TOKEN / APP_ID / AVATAR_ID)' },
      { status: 500 },
    )
  }

  return NextResponse.json({ sessionToken, appId, avatarId })
}
