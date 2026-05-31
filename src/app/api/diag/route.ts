import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

const LOG_PATH = join(process.cwd(), 'logs', 'avatar-diag.jsonl')

export async function POST(req: Request) {
  try {
    const entry = await req.json() as unknown
    const line  = JSON.stringify({ ts: new Date().toISOString(), ...entry as object }) + '\n'
    mkdirSync(join(process.cwd(), 'logs'), { recursive: true })
    appendFileSync(LOG_PATH, line, 'utf8')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
