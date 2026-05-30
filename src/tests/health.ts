import type { JarvisClient } from '../lib/client'

export async function run(client: JarvisClient): Promise<void> {
  const result = await client.health()
  if (result.status !== 'ok')
    throw new Error(`Expected status=ok, got: ${JSON.stringify(result)}`)
  console.log(`    status: ${result.status}`)
}
