# CLAUDE.md — Jarvis

> Mis à jour le 2026-06-01 (branche : dev)

## Projet

Jarvis est un assistant personnel inspiré d'Iron Man/Batman.
Interface conversationnelle avec avatar 3D animé piloté par LLM + SpatialReal AvatarKit.

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 15.5.18, React 19, TypeScript, Tailwind v4 |
| Avatar | @spatialwalk/avatarkit (SDK mode, WebSocket direct) |
| LLM | Anthropic Claude (claude-sonnet-4-6) |
| STT serveur | Deepgram WebSocket via /ws/stt |

## Commandes

```
dev:        tsx server.ts        (serveur HTTP custom + WebSocket STT)
dev:next:   next dev
build:      next build
start:      NODE_ENV=production tsx server.ts
lint:       next lint
type-check: tsc --noEmit
```

## Architecture

```
src/
├── app/
│   ├── page.tsx                   Charge JarvisAvatar (ssr:false)
│   ├── layout.tsx
│   ├── test/page.tsx              Interface de test /api/chat (SSE)
│   └── api/
│       ├── avatar-token/          POST → SPATIALREAL_SESSION_TOKEN + appId + avatarId
│       ├── chat/                  POST streaming LLM → SSE (text_delta, avatar_complete)
│       ├── tts/                   Proxy ElevenLabs MP3
│       ├── tts-pcm/               Proxy ElevenLabs PCM 16kHz
│       └── diag/                  Logging diagnostique
│
├── components/
│   └── JarvisAvatar.tsx           Composant principal — SDK mode SpatialReal
│
├── lib/
│   ├── anthropic.ts               Client Anthropic + avatarTool + SYSTEM_PROMPT
│   ├── stt.ts                     Session Deepgram WebSocket (côté serveur)
│   ├── activeStreams.ts            Registre AbortController (barge-in)
│   └── logger.ts                  Logging structuré
│
├── types/
│   ├── avatar.ts                  AvatarResponse, AnimationCommand, EmotionName
│   ├── api.ts                     ChatRequest, SSEEvent
│   └── avatarkit.ts               WsClientMessage, WsServerMessage (/ws/stt)
│
└── instrumentation.ts             Init fichier de log au démarrage

server.ts                          Serveur HTTP custom Next.js + WebSocket /ws/stt
public/wasm/                       WASM AvatarKit (servi HTTP par Next.js)
scripts/wasm-patch-loader.cjs      Patch WASM data-URI → URL publique
```

## Flow principal

```
Navigateur                         Serveur (server.ts / Next.js)

[Connecter avatar] clic
  → POST /api/avatar-token         Retourne SPATIALREAL_SESSION_TOKEN
  → AvatarSDK.initialize()
  → AvatarManager.load(avatarId)   Télécharge modèle 3D
  → new AvatarView(avatar, div)    Injecte canvas WebGL
  → ctrl.start()                   Ouvre WebSocket SpatialReal

[Message texte]
  → POST /api/chat (SSE)           Claude (tool_use forcé)
  ← text_delta SSE                 Token par token
  ← avatar_complete SSE            AvatarResponse JSON complet

[Micro] (endpoint disponible, UI non câblée)
  ↔ WebSocket /ws/stt              PCM audio → Deepgram → transcript
```

## Composant JarvisAvatar

Port direct du demo `spatialreal-speech-to-avatar-quickstart` (Vue → React).

- **Pas d'auto-connect** : le clic "Connecter avatar" est requis (geste utilisateur
  nécessaire pour `initializeAudioContext()` sous Chrome)
- `onConnectionState` enregistré AVANT `ctrl.start()` → détecte 'connected' / 'failed'
- `connectionSucceeded` local : détecte si `ctrl.start()` résout en mode fallback
- Bouton "Test audio" : envoie le PCM demo SpatialReal via `ctrl.send(buffer, true)`

## Variables d'environnement (.env.local)

```bash
ANTHROPIC_API_KEY=...

# SpatialReal — SDK mode direct
NEXT_PUBLIC_SPATIALREAL_APP_ID=...
NEXT_PUBLIC_AVATARKIT_AVATAR_ID=...
SPATIALREAL_SESSION_TOKEN=...        # JWT — régénérer sur app.spatialreal.ai/apps

# Deepgram STT (WebSocket serveur /ws/stt)
DEEPGRAM_API_KEY=...

# ElevenLabs TTS (routes /api/tts et /api/tts-pcm)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

## WASM AvatarKit

`scripts/wasm-patch-loader.cjs` patche deux fichiers dans `node_modules/.../dist/` :
- `avatar_core_wasm-*.js` (Pattern A : `_scriptName`, Pattern B1 : data-URI standalone)
- `index-*.js` (Pattern B2 : data-URI 1.27 Mo inline → URL `/public/wasm/`)

Avec `enforce:'pre'` dans webpack via `withAvatarkit()` dans `next.config.mjs`.

## Commits récents

```
feat: refonte JarvisAvatar — SDK mode SpatialReal direct, sans LiveKit
chore: déplacer PostCompact vers settings global
fix: z-index sur éléments UI pour passer au-dessus du canvas WebGL
fix: use client sur page.tsx pour ssr:false dynamic
feat: repartir du demo — JarvisAvatar avec code avatar identique au demo
fix: getUpgradeHandler() après prepare()
feat: remplacement LiveKit par SDK mode SpatialReal direct
```
