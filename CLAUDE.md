# CLAUDE.md â€” Jarvis

> Mis Ã  jour automatiquement le 2026-05-29 17:12 (branche : dev)

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
80abba3 feat: hooks auto-update CLAUDE.md + compact history
b36c6f1 docs: compact history 2026-05-29_17-11 [auto]
8157151 chore: update CLAUDE.md [auto]
4b0be3e Merge branch 'claude/avatar-webrtc-integration-M93e9' into dev
45e9b74 feat: int├®gration AvatarKit SpatialReal + agent Python LiveKit
c6d3ac4 feat: int├®gration WebRTC AvatarKit SpatialReal + STT Deepgram + barge-in
03f3b7e chore: upgrade Next.js to 15.5.18 to patch CVE-2025-66478
74f3963 feat: futuristic JARVIS HUD avatar selectable via CARACTER_NAME
62a7791 feat: make character name configurable via CARACTER_NAME env var
3c434a4 Merge pull request #1 from do4fun/dev
```
