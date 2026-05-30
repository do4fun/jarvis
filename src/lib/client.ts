import WebSocket from 'ws'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface AvatarResponse {
  text: string
  animation: { name: string; intensity?: number; duration?: number }
  emotion: string
}

export type SSEEvent =
  | { type: 'text_delta';      content: string }
  | { type: 'avatar_complete'; response: AvatarResponse }
  | { type: 'error';           message: string }
  | { type: 'done' }

export interface TokenResponse {
  token:    string
  url:      string
  room:     string
  identity: string
}

// ── Client ────────────────────────────────────────────────────────────────────

export class JarvisClient {
  constructor(private readonly baseUrl: string = 'http://localhost:3001') {}

  // GET /health
  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/health`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<{ status: string }>
  }

  // POST /api/token
  async token(room = 'jarvis-room'): Promise<TokenResponse> {
    const res = await fetch(`${this.baseUrl}/api/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ room }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    return res.json() as Promise<TokenResponse>
  }

  // POST /api/chat — SSE stream
  async *chat(
    message: string,
    options: { history?: ChatHistoryItem[]; avatarSessionId?: string; room?: string } = {},
  ): AsyncGenerator<SSEEvent> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message,
        history:         options.history ?? [],
        avatarSessionId: options.avatarSessionId,
        room:            options.room,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    if (!res.body) throw new Error('No response body')

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let   buffer  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim()
          if (raw) yield JSON.parse(raw) as SSEEvent
        }
      }
    }
  }

  // WS /ws/stt
  connectSTT(): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws/stt'
    return new WebSocket(wsUrl)
  }
}
