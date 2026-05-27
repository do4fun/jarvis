// ─────────────────────────────────────────────────────────────────────────────
// Serveur custom Next.js 15 + WebSocket STT
//
// Next.js App Router ne supporte pas les WebSockets nativement.
// Ce serveur HTTP wrappé expose :
//   - Port 3000 : requêtes Next.js standard (HTTP/SSE)
//   - ws://host/ws/stt : WebSocket pour le streaming audio STT
//
// Optimisations latence :
//   1. Le serveur HTTP et le WebSocket partagent le même port → pas de
//      requêtes CORS supplémentaires pour l'upgrade WebSocket
//   2. La connexion Deepgram est établie dès l'ouverture du WebSocket
//      (pas à la réception du premier chunk audio)
//   3. Le registre activeStreams est accessible depuis les routes API
//      (même processus Node.js, même module importé)
// ─────────────────────────────────────────────────────────────────────────────

import { createServer, type IncomingMessage } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import type { Socket } from 'net'
import { createSTTSession } from './src/lib/stt.js'
import { interruptSession } from './src/lib/avatarkit.js'
import { activeStreams } from './src/lib/activeStreams.js'
import { logger } from './src/lib/logger.js'
import type { WsClientMessage } from './src/types/avatarkit.js'

const CTX  = 'Server'
const port = parseInt(process.env.PORT ?? '3000', 10)
const dev  = process.env.NODE_ENV !== 'production'

// ── Initialisation Next.js ────────────────────────────────────────────────────

const app    = next({ dev, port })
const handle = app.getRequestHandler()

// ── Handler WebSocket STT ─────────────────────────────────────────────────────

function handleSTTConnection(ws: WebSocket, _req: IncomingMessage) {
  logger.info(CTX, '← WebSocket STT connexion ouverte')

  // Langue par défaut (peut être surchargée via message 'config')
  let language    = 'fr'
  let sttSession  = createSTTSession(ws, language)

  ws.on('message', (data: Buffer | string) => {
    let msg: WsClientMessage

    try {
      msg = JSON.parse(typeof data === 'string' ? data : data.toString()) as WsClientMessage
    } catch {
      return // Ignorer les frames malformées
    }

    switch (msg.type) {
      case 'config': {
        // Reconfigurer la langue STT → fermer et rouvrir la connexion Deepgram
        language = msg.language
        sttSession.close()
        sttSession = createSTTSession(ws, language)
        logger.info(CTX, '↺ STT reconfiguré', { language })
        break
      }

      case 'audio_chunk': {
        // Décoder le PCM16 base64 et l'envoyer à Deepgram
        const pcmBuffer = Buffer.from(msg.data, 'base64')
        sttSession.sendAudio(pcmBuffer)
        break
      }

      case 'barge_in': {
        // Mécanisme barge-in :
        // 1. Annuler le stream Claude en cours (AbortController)
        // 2. Interrompre l'avatar AvatarKit
        const { avatarSessionId } = msg
        logger.info(CTX, '⚡ barge-in via WebSocket', { avatarSessionId })

        const controller = activeStreams.get(avatarSessionId)
        if (controller) {
          controller.abort('barge-in')
          activeStreams.delete(avatarSessionId)
          logger.info(CTX, '✓ stream Claude annulé via WebSocket')
        }

        // Interruption AvatarKit en parallèle (fire-and-forget)
        void interruptSession({ sessionId: avatarSessionId }).catch((err) => {
          logger.error(CTX, '✗ interrupt AvatarKit depuis WebSocket', { err: String(err) })
        })

        break
      }
    }
  })

  ws.on('close', () => {
    logger.info(CTX, '→ WebSocket STT connexion fermée')
    sttSession.close()
  })

  ws.on('error', (err) => {
    logger.error(CTX, '✗ WebSocket STT error', { err: String(err) })
    sttSession.close()
  })
}

// ── Démarrage ─────────────────────────────────────────────────────────────────

void app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)
    handle(req, res, parsedUrl)
  })

  // WebSocket Server — partage le même port HTTP via upgrade
  const wss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = parse(req.url ?? '/', true)

    if (pathname === '/ws/stt') {
      wss.handleUpgrade(req, socket as import('stream').Duplex, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else {
      // Rejeter toute autre tentative d'upgrade WebSocket
      socket.destroy()
    }
  })

  wss.on('connection', handleSTTConnection)

  httpServer.listen(port, () => {
    logger.info(CTX, `▲ Jarvis prêt sur http://localhost:${port}`)
    console.log(`\n▲ Jarvis prêt sur http://localhost:${port}`)
    console.log(`  WebSocket STT : ws://localhost:${port}/ws/stt\n`)
  })
})
