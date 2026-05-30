import { JarvisClient } from './lib/client'
import * as health from './tests/health'
import * as token  from './tests/token'
import * as chat   from './tests/chat'
import * as stt    from './tests/stt'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

const G = '\x1b[32m'  // green
const R = '\x1b[31m'  // red
const Y = '\x1b[33m'  // yellow
const D = '\x1b[2m'   // dim
const B = '\x1b[1m'   // bold
const X = '\x1b[0m'   // reset

const TESTS: { name: string; fn: (c: JarvisClient) => Promise<void> }[] = [
  { name: 'GET  /health',    fn: health.run },
  { name: 'POST /api/token', fn: token.run  },
  { name: 'POST /api/chat',  fn: chat.run   },
  { name: 'WS   /ws/stt',    fn: stt.run    },
]

async function main() {
  console.log(`\n${B}▲ Jarvis Backend — Test Suite${X}`)
  console.log(`${D}  backend : ${BACKEND_URL}${X}\n`)

  const client = new JarvisClient(BACKEND_URL)
  let passed = 0
  let failed = 0

  for (const test of TESTS) {
    console.log(`${Y}▶${X} ${B}${test.name}${X}`)
    const t0 = Date.now()
    try {
      await test.fn(client)
      console.log(`${G}  ✓ PASS${X} ${D}(${Date.now() - t0}ms)${X}\n`)
      passed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`${R}  ✗ FAIL — ${msg}${X}\n`)
      failed++
    }
  }

  console.log(`${'─'.repeat(40)}`)
  console.log(`${B}${passed}/${TESTS.length} tests passés${X}`)
  if (failed > 0) {
    console.log(`${R}${failed} échoué(s)${X}`)
    process.exit(1)
  }
}

void main()
