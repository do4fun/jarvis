import { NextResponse } from 'next/server'

// SPATIALREAL_SESSION_TOKEN : JWT temporaire généré sur https://app.spatialreal.ai/apps
// À régénérer manuellement depuis le dashboard quand il expire.
export async function POST() {
  const sessionToken = process.env.SPATIALREAL_SESSION_TOKEN
  const appId        = process.env.NEXT_PUBLIC_SPATIALREAL_APP_ID
  const avatarId     = process.env.NEXT_PUBLIC_AVATARKIT_AVATAR_ID

  if (!sessionToken || !appId || !avatarId) {
    const missing = [
      !sessionToken && 'SPATIALREAL_SESSION_TOKEN',
      !appId        && 'NEXT_PUBLIC_SPATIALREAL_APP_ID',
      !avatarId     && 'NEXT_PUBLIC_AVATARKIT_AVATAR_ID',
    ].filter(Boolean).join(', ')
    return NextResponse.json(
      { error: `Variables manquantes dans .env.local : ${missing}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ sessionToken, appId, avatarId })
}
