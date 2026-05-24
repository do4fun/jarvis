import { NextRequest } from 'next/server'
import { anthropic, avatarTool, SYSTEM_PROMPT } from '@/lib/anthropic'
import type { AvatarResponse } from '@/types/avatar'
import type { ChatRequest, SSEEvent } from '@/types/api'

// ── Text field streaming extractor ────────────────────────────────────────────
//
// As Claude streams the tool's input_json_delta, the JSON is built up
// incrementally: {"text":"Bon...jour !","animation":...}
// This class extracts the "text" field value character-by-character so the
// frontend can render words as they arrive — before the full JSON is complete.

class TextFieldExtractor {
  private buf = ''
  private phase: 'seeking' | 'in_value' | 'done' = 'seeking'
  private ptr = 0

  feed(delta: string): string {
    if (this.phase === 'done') return ''
    this.buf += delta

    if (this.phase === 'seeking') {
      const marker = '"text":"'
      const idx = this.buf.indexOf(marker)
      if (idx === -1) return ''
      this.ptr = idx + marker.length
      this.phase = 'in_value'
    }

    let out = ''
    while (this.ptr < this.buf.length) {
      const ch = this.buf[this.ptr]

      if (ch === '\\') {
        // Need the next char to decode the escape sequence
        if (this.ptr + 1 >= this.buf.length) break // wait for next chunk
        const esc = this.buf[this.ptr + 1]
        out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc
        this.ptr += 2
      } else if (ch === '"') {
        // Unescaped closing quote — text field is complete
        this.phase = 'done'
        this.ptr++
        break
      } else {
        out += ch
        this.ptr++
      }
    }

    return out
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: ChatRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  if (!body.message?.trim()) {
    return new Response(JSON.stringify({ error: '"message" is required' }), { status: 400 })
  }

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...(body.history ?? []).map(turn => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: 'user', content: body.message },
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: [avatarTool],
          // Force Claude to always call our tool — no plain-text fallback
          tool_choice: { type: 'any' },
          messages,
        })

        const extractor = new TextFieldExtractor()
        let jsonBuffer = ''

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'input_json_delta'
          ) {
            const delta = event.delta.partial_json
            jsonBuffer += delta

            const textChunk = extractor.feed(delta)
            if (textChunk) {
              emit({ type: 'text_delta', content: textChunk })
            }
          }
        }

        if (!jsonBuffer) {
          throw new Error('Claude returned an empty tool input.')
        }

        const avatarResponse = JSON.parse(jsonBuffer) as AvatarResponse
        emit({ type: 'avatar_complete', response: avatarResponse })
        emit({ type: 'done' })
      } catch (err) {
        emit({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Prevents nginx / Vercel edge from buffering the stream
      'X-Accel-Buffering': 'no',
    },
  })
}
