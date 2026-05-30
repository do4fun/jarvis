import type { JarvisClient } from '../lib/client'

export async function run(client: JarvisClient): Promise<void> {
  const result = await client.token('test-room')

  if (!result.token)    throw new Error('Missing token')
  if (!result.url)      throw new Error('Missing url')
  if (!result.room)     throw new Error('Missing room')
  if (!result.identity) throw new Error('Missing identity')

  // Vérification basique que c'est un JWT (3 segments base64 séparés par '.')
  if (result.token.split('.').length !== 3)
    throw new Error('token ne ressemble pas à un JWT valide')

  console.log(`    room:     ${result.room}`)
  console.log(`    identity: ${result.identity}`)
  console.log(`    url:      ${result.url}`)
  console.log(`    token:    ${result.token.slice(0, 24)}…`)
}
