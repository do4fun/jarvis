# CLAUDE.md â€” Jarvis

> Mis Ã  jour automatiquement le 2026-05-31 21:44 (branche : dev)

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
55ead40 feat: repartir du demo ÔÇö JarvisAvatar avec code avatar identique au demo
6076939 chore: update CLAUDE.md [auto]
8f1ecf3 fix: getUpgradeHandler() apr├¿s prepare()
0c75fb6 chore: update CLAUDE.md [auto]
aac1b31 fix: passer /_next/webpack-hmr au handler Next.js (HMR WebSocket)
a4cbbaa chore: update CLAUDE.md [auto]
aee6eb1 fix: onReady dans useEffect + catch erreur server.ts
dd6ab51 chore: update CLAUDE.md [auto]
ecb1e87 fix: wasm-patch-loader sur tout le dist/ ÔÇö withAvatarkit ne patchait pas index-*.js (data-URI 1.27Mo)
8010fda chore: update CLAUDE.md [auto]
```
