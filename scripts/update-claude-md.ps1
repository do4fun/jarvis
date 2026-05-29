# scripts/update-claude-md.ps1
# Régénère CLAUDE.md après chaque git commit et le commet automatiquement.

$ErrorActionPreference = 'SilentlyContinue'
$root   = git rev-parse --show-toplevel
$branch = git rev-parse --abbrev-ref HEAD
$log    = (git log --oneline -10) -join "`n"
$date   = Get-Date -Format 'yyyy-MM-dd HH:mm'

$pkg         = Get-Content "$root/package.json" -Raw | ConvertFrom-Json
$nextVer     = $pkg.dependencies.next
$scriptsList = ($pkg.scripts.PSObject.Properties |
    ForEach-Object { "  $($_.Name): ``$($_.Value)``" }) -join "`n"

$content = @"
# CLAUDE.md — Jarvis

> Mis à jour automatiquement le $date (branche : $branch)

## Projet

Jarvis est un assistant personnel inspiré d'Iron Man/Batman.
Interface conversationnelle avec avatar 3D animé piloté par LLM + TTS + SpatialReal.

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js $nextVer, React 19, TypeScript, Tailwind v4 |
| Avatar | @spatialwalk/avatarkit + avatarkit-rtc (WebGL + LiveKit WebRTC) |
| LLM | Anthropic Claude (claude-sonnet-4-6) |
| Agent vocal | LiveKit Agents Python + Deepgram STT + Cartesia TTS + SpatialReal |
| Infra temps réel | LiveKit Cloud |
| State | Zustand |

## Commandes

$scriptsList

## Architecture clé

``````
src/app/api/chat/      POST streaming LLM → SSE + forward LiveKit data channel
src/app/api/token/     POST JWT LiveKit + dispatch agent Python
src/components/canvas/ AvatarKitSection, AvatarKitPlayer (WebGL)
src/hooks/             useSpatialRealAvatar, useJarvis, useChat
src/lib/               anthropic, activeStreams (barge-in)
backend/agent.py       VAD → STT → LLM → TTS → SpatialReal AvatarSession
public/wasm/           WASM AvatarKit (servi HTTP par Next.js)
scripts/               wasm-patch-loader.cjs, update-claude-md.ps1
``````

## Commits récents

``````
$log
``````
"@

Set-Content -Path "$root/CLAUDE.md" -Value $content -Encoding utf8

$status = git -C $root status --short CLAUDE.md
if ($status -match '[MA]') {
    git -C $root add CLAUDE.md
    git -C $root commit -m 'chore: update CLAUDE.md [auto]'
}
