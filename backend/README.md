# Jarvis Agent Backend

Pipeline voix LiveKit avec avatar SpatialReal.

## Prérequis

- Python 3.10–3.14
- [uv](https://docs.astral.sh/uv/) (`pip install uv` ou `curl -LsSf https://astral.sh/uv/install.sh | sh`)

## Setup

```bash
cd backend
cp .env.example .env
# Remplir les clés dans .env

uv sync
```

## Démarrage

```bash
# Terminal 1 — Agent worker
uv run agent.py dev

# (le serveur Next.js gère les tokens — pas de token_server.py séparé)
```

## Comptes requis

| Service | Clé | Gratuit? |
|---------|-----|---------|
| LiveKit Cloud | `LIVEKIT_*` | Tier gratuit |
| OpenAI | `LLM_API_KEY` | Payant |
| Cartesia | `CARTESIA_API_KEY` | Crédits offerts |
| Deepgram | `DEEPGRAM_API_KEY` | Tier gratuit |
| SpatialReal | `SPATIALREAL_*` | Selon plan |
