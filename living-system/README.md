# living-system

AI-driven Minecraft bots with distinct personalities, developmental psychology (Kegan levels), trust dynamics, and document-based memory — powered by local LLMs via Ollama.

## Architecture

```
core/           — game-agnostic engine (documents, personality, LLM, memory, decisions)
adapters/       — game-specific implementations (minecraft-vanilla/)
orchestrator/   — bot lifecycle management and logging
personas/       — JSON personality files
config/         — runtime settings
```

**Key principle:** nothing in `core/` knows about Minecraft. All game-specific code lives in `adapters/minecraft-vanilla/`. Swapping games means writing a new adapter, not touching core.

## Decision Loop

Each bot runs a continuous cycle:

1. **Perceive** — adapter reads game state into a generic format
2. **Prompt** — build LLM prompt from persona + perception + memory + trust
3. **Call** — send prompt to Ollama
4. **Parse** — extract structured decision (action, speech, thought, journal)
5. **Execute** — adapter performs the chosen action in-game

## Prerequisites

- Node.js 18+
- Docker & Docker Compose (for Minecraft server)
- Ollama with a model pulled (e.g. `ollama pull llama3`)

## Quick Start

```bash
# Start Minecraft server
docker compose up -d

# Install dependencies
npm install

# Start the bots
node src/index.js
```

## Personas

Each bot has a JSON personality file defining:
- **Kegan level** (2–5) — developmental stage affecting decision-making
- **Traits** — personality adjectives
- **Honesty** — whether the bot is truthful or deceptive
- **Speech style** — how the bot communicates
- **Goals** — long-term objectives
- **Backstory** — narrative background

See `personas/` for examples.

## Status

**Scaffold only** — interfaces and stubs are in place. No logic implemented yet.
