import type { JarvisClient } from '../lib/client'

export async function run(client: JarvisClient): Promise<void> {
  let textReceived    = ''
  let avatarComplete  = false
  let doneReceived    = false

  process.stdout.write('    streaming → ')

  for await (const event of client.chat('Dis bonjour en une seule phrase courte.')) {
    switch (event.type) {
      case 'text_delta':
        process.stdout.write(event.content)
        textReceived += event.content
        break
      case 'avatar_complete':
        avatarComplete = true
        console.log()
        console.log(`    animation : ${event.response.animation.name}`)
        console.log(`    émotion   : ${event.response.emotion}`)
        break
      case 'done':
        doneReceived = true
        break
      case 'error':
        throw new Error(`Erreur SSE : ${event.message}`)
    }
  }

  if (!textReceived)   throw new Error('Aucun text_delta reçu')
  if (!avatarComplete) throw new Error('Événement avatar_complete manquant')
  if (!doneReceived)   throw new Error('Événement done manquant')
}
