// ── Animation ─────────────────────────────────────────────────────────────────

/** Names must match animation clips exported in the GLB rig */
export type AnimationName =
  | 'idle'
  | 'talking'
  | 'nodding'
  | 'thinking'
  | 'waving'
  | 'surprised'
  | 'shaking_head'

export interface AnimationCommand {
  name: AnimationName
  /** Blend weight 0.0–1.0 (default: 1.0) */
  intensity?: number
  /** Duration in seconds; undefined = loop until next command */
  duration?: number
  /** Crossfade from the previous animation (default: true) */
  crossFade?: boolean
}

// ── Emotion ───────────────────────────────────────────────────────────────────

/** Names must match morph targets on the face mesh */
export type EmotionName =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'curious'
  | 'excited'
  | 'confused'

// ── Environment ───────────────────────────────────────────────────────────────

export type EnvironmentPreset =
  | 'default'
  | 'night'
  | 'office'
  | 'outdoor'
  | 'studio'
  | 'warehouse'

export interface EnvironmentCommand {
  preset?: EnvironmentPreset
  /** Ambient light intensity 0.0–1.0 */
  ambientIntensity?: number
  /** Background hex color, e.g. "#1a1a2e" */
  backgroundColor?: string
}

// ── AvatarResponse — LLM ↔ Frontend contract ─────────────────────────────────

/**
 * Every Claude response MUST conform to this shape.
 * The orchestrator returns this as JSON; the frontend deserialises it
 * and drives animations, TTS, and scene changes.
 */
export interface AvatarResponse {
  /** Displayed in the UI and sent to ElevenLabs for TTS */
  text: string
  /** Body / gesture animation to blend on the rig */
  animation: AnimationCommand
  /** Facial expression applied via morph targets */
  emotion: EmotionName
  /** Optional scene / lighting adjustments */
  environment?: EnvironmentCommand
  metadata?: {
    /** Show a "thinking…" indicator while streaming */
    thinking?: boolean
    /** BCP-47 language tag for TTS voice selection, e.g. "fr-FR" */
    language?: string
  }
}

// ── Conversation ──────────────────────────────────────────────────────────────

export interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** Populated only for assistant turns */
  avatarResponse?: AvatarResponse
}
