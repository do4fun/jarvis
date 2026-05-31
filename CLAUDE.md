# CLAUDE.md â€” Jarvis

> Mis Ã  jour automatiquement le 2026-05-31 08:15 (branche : dev)

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
dca4289 fix: ├®tendre wasm-patch-loader ├á index-BFNu-mKX.js + fix generator.asset.filename
cad4d43 chore: update CLAUDE.md [auto]
1b68fc6 fix: ajouter enforce:'pre' au wasm-patch-loader
ac528dc chore: update CLAUDE.md [auto]
569aa75 fix: corriger chargement WASM beta.104 + loader version-agnostique
bfd1ee4 chore: update CLAUDE.md [auto]
cc536e4 fix: mise ├á jour avatarkit beta.104 + withAvatarkit + DrivingServiceMode.host
51fc0b1 chore: update CLAUDE.md [auto]
47a4c08 fix: save-compact-history lit compact_summary + formate en markdown lisible
ea43508 chore: update CLAUDE.md [auto]
```
