import readline from 'readline'
import { JarvisClient } from './lib/client'
import type { ChatHistoryItem } from './lib/client'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

const G = '\x1b[32m'   // green
const B = '\x1b[34m'   // blue
const C = '\x1b[36m'   // cyan
const R = '\x1b[31m'   // red
const D = '\x1b[2m'    // dim
const BD = '\x1b[1m'   // bold
const X  = '\x1b[0m'   // reset

const client  = new JarvisClient(BACKEND_URL)
const history: ChatHistoryItem[] = []

const rl = readline.createInterface({
  input:    process.stdin,
  output:   process.stdout,
  terminal: true,
})

async function sendMessage(message: string): Promise<void> {
  let fullText = ''

  process.stdout.write(`\n${G}${BD}Jarvis${X} `)

  for await (const event of client.chat(message, { history })) {
    switch (event.type) {
      case 'text_delta':
        process.stdout.write(event.content)
        fullText += event.content
        break

      case 'avatar_complete': {
        const r = event.response
        console.log(`\n${D}[${r.animation.name} · ${r.emotion}]${X}`)
        // Maintenir l'historique (max 10 échanges = 20 turns)
        history.push({ role: 'user',      content: message   })
        history.push({ role: 'assistant', content: r.text    })
        if (history.length > 20) history.splice(0, 2)
        break
      }

      case 'error':
        console.error(`\n${R}Erreur : ${event.message}${X}`)
        break

      case 'done':
        break
    }
  }

  if (!fullText) console.log(`${D}(réponse vide)${X}`)
  console.log()
}

function prompt(): void {
  rl.question(`${BD}${B}Vous${X} `, async (input) => {
    const message = input.trim()

    if (!message) { prompt(); return }

    if (message === '/quit' || message === '/exit') {
      console.log('\nAu revoir.')
      rl.close()
      process.exit(0)
    }

    if (message === '/clear') {
      history.length = 0
      console.log(`${D}Historique effacé.${X}`)
      prompt()
      return
    }

    if (message === '/history') {
      console.log(history.length
        ? history.map((t, i) => `  ${i} [${t.role}] ${t.content.slice(0, 80)}`).join('\n')
        : `${D}(historique vide)${X}`,
      )
      prompt()
      return
    }

    try {
      await sendMessage(message)
    } catch (err) {
      console.error(`${R}Erreur : ${err instanceof Error ? err.message : String(err)}${X}`)
    }

    prompt()
  })
}

async function main() {
  console.log(`\n${BD}▲ Jarvis Interactive Client${X}`)
  console.log(`${D}  backend  : ${C}${BACKEND_URL}${X}`)
  console.log(`${D}  commandes: /clear  /history  /quit${X}\n`)

  try {
    await client.health()
    console.log(`  ${G}✓ Backend accessible${X}\n`)
  } catch {
    console.error(`  ${R}✗ Backend inaccessible — démarrer jarvis-backend (npm run dev)${X}\n`)
  }

  prompt()
}

void main()
