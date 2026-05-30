import type { JarvisClient } from '../lib/client'

const TIMEOUT_MS = 5_000

export async function run(client: JarvisClient): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = client.connectSTT()

    const timeout = setTimeout(() => {
      ws.close()
      // Timeout sans "ready" = DEEPGRAM_API_KEY probablement absent côté serveur.
      // On distingue ce cas d'une vraie erreur de connexion.
      reject(new Error(
        `Aucun message "ready" en ${TIMEOUT_MS}ms — ` +
        'vérifier DEEPGRAM_API_KEY dans le backend',
      ))
    }, TIMEOUT_MS)

    ws.on('open', () => {
      console.log('    WebSocket ouvert')
      // Envoyer la config de langue pour déclencher la réponse "ready"
      ws.send(JSON.stringify({ type: 'config', language: 'fr' }))
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string }
        console.log(`    message reçu : ${JSON.stringify(msg)}`)
        if (msg.type === 'ready') {
          clearTimeout(timeout)
          ws.close()
          resolve()
        }
      } catch {
        // Ignorer les frames non-JSON
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`WebSocket erreur : ${err.message}`))
    })
  })
}
