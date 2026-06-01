// Messages WebSocket STT (/ws/stt) — utilisés par server.ts

export type WsClientMessage =
  | {
      type: 'audio_chunk'
      /** ArrayBuffer PCM16 encodé en base64 (128 samples = 8ms @ 16kHz) */
      data: string
    }
  | {
      type: 'barge_in'
      avatarSessionId: string
    }
  | { type: 'config'; language: string }

export type WsServerMessage =
  | {
      type: 'transcript'
      text: string
      isFinal: boolean
    }
  | { type: 'error'; message: string }
  | { type: 'ready' }
