# CLAUDE.md â€” Jarvis

> Mis Ã  jour automatiquement le 2026-05-31 21:03 (branche : dev)

## Projet

Jarvis est un assistant personnel inspirÃ© d'Iron Man/Batman.
Interface conversationnelle avec avatar 3D animÃ© pilotÃ© par LLM + TTS + SpatialReal.

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 15.5.18, React 19, TypeScript, Tailwind v4 |
| Avatar | @spatialwalk/avatarkit + avatarkit-rtc (WebGL + LiveKit WebRTC) |
| LLM | Anthropic Claude (claude-sonnet-4-6) |
| Agent vocal | LiveKit Agents Python + Deepgram STT + Cartesia TTS + SpatialReal |
| Infra temps rÃ©el | LiveKit Cloud |
| State | Zustand |

## Commandes

  dev: `tsx server.ts`
  dev:next: `next dev`
  build: `next build`
  start: `NODE_ENV=production tsx server.ts`
  lint: `next lint`
  type-check: `tsc --noEmit`

## Architecture clÃ©

```
src/app/api/chat/      POST streaming LLM â†’ SSE + forward LiveKit data channel
src/app/api/token/     POST JWT LiveKit + dispatch agent Python
src/components/canvas/ AvatarKitSection, AvatarKitPlayer (WebGL)
src/hooks/             useSpatialRealAvatar, useJarvis, useChat
src/lib/               anthropic, activeStreams (barge-in)
backend/agent.py       VAD â†’ STT â†’ LLM â†’ TTS â†’ SpatialReal AvatarSession
public/wasm/           WASM AvatarKit (servi HTTP par Next.js)
scripts/               wasm-patch-loader.cjs, update-claude-md.ps1
```

## Commits rÃ©cents

```
4e3f600 feat: remplacement LiveKit par SDK mode SpatialReal direct
e8983ec chore: update CLAUDE.md [auto]
a22f089 fix(diag): container DOM direct + ├®coute trackSubscribed
7e1b744 chore: update CLAUDE.md [auto]
36bf695 diag: ├®chantillonnage continu WebRTC ÔåÆ logs/avatar-diag.jsonl
81d79c9 chore: update CLAUDE.md [auto]
fe49d68 diag: ajouter logAvatarDiagnostics() au moment de la connexion avatar
3733a97 chore: update CLAUDE.md [auto]
dca4289 fix: ├®tendre wasm-patch-loader ├á index-BFNu-mKX.js + fix generator.asset.filename
cad4d43 chore: update CLAUDE.md [auto]
```
