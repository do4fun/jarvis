import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

// Singleton — one client for the entire server process
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── System prompt ─────────────────────────────────────────────────────────────

const CHARACTER_NAME = process.env.CARACTER_NAME ?? 'Jarvis'

export const SYSTEM_PROMPT = `\
You are ${CHARACTER_NAME}, an AI personal assistant. \
You are highly capable, professional, and warm, with a measured British-inflected tone.

RULES — read carefully:
1. You MUST always respond by calling the send_avatar_response tool. Never write plain text.
2. The "text" field is spoken aloud via TTS — write for speech, not reading.
3. Choose animation and emotion that match the emotional context of your reply.
4. Keep responses concise: 1–3 sentences unless detail is explicitly required.
5. Default animation for substantive replies: "talking".
6. Use animation "thinking" + emotion "curious" when you reflect before answering.`

// ── Tool definition — mirrors the AvatarResponse type exactly ────────────────

export const avatarTool: Tool = {
  name: 'send_avatar_response',
  description:
    'Send the avatar response. MUST be called for every single reply — never skip it.',
  input_schema: {
    type: 'object' as const,
    required: ['text', 'animation', 'emotion'],
    properties: {
      text: {
        type: 'string',
        description: 'Text to speak aloud and display. Written for speech.',
      },
      animation: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            enum: [
              'idle',
              'talking',
              'nodding',
              'thinking',
              'waving',
              'surprised',
              'shaking_head',
            ],
            description: 'Must match a clip name exported from the GLB rig.',
          },
          intensity: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Blend weight (default 1.0).',
          },
          duration: {
            type: 'number',
            description: 'Seconds to play. Omit to loop until next command.',
          },
          crossFade: {
            type: 'boolean',
            description: 'Crossfade from the previous animation (default true).',
          },
        },
      },
      emotion: {
        type: 'string',
        enum: [
          'neutral',
          'happy',
          'sad',
          'angry',
          'surprised',
          'curious',
          'excited',
          'confused',
        ],
        description: 'Applied via face morph targets.',
      },
      environment: {
        type: 'object',
        description: 'Optional scene changes.',
        properties: {
          preset: {
            type: 'string',
            enum: ['default', 'night', 'office', 'outdoor', 'studio', 'warehouse'],
          },
          ambientIntensity: { type: 'number', minimum: 0, maximum: 1 },
          backgroundColor: {
            type: 'string',
            description: 'Hex color string, e.g. "#1a1a2e".',
          },
        },
      },
      metadata: {
        type: 'object',
        properties: {
          thinking: {
            type: 'boolean',
            description: 'Show a thinking indicator in the UI.',
          },
          language: {
            type: 'string',
            description: 'BCP-47 language code for TTS, e.g. "fr-FR".',
          },
        },
      },
    },
  },
}
