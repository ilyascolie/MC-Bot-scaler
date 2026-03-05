# living-system

AI-driven Minecraft bots with distinct personalities, developmental psychology (Kegan levels), trust dynamics, and document-based social contracts — powered by local LLMs via Ollama.

10 bots spawn into a shared Minecraft survival world. Each one has a unique personality, psychological development level, and social tendencies. They perceive the world, reason about it through an LLM, make decisions, form agreements, build trust (or betray it), and act — all autonomously.

## Prerequisites

- **Node.js 18+** — `node --version` should show v18 or higher
- **Docker & Docker Compose** — for the Minecraft server
- **Ollama** — local LLM server ([ollama.ai](https://ollama.ai))

### Pull a model

```bash
# Recommended model (good balance of quality and speed)
ollama pull qwen3:14b

# Or use a smaller model for faster responses
ollama pull llama3
```

Set the model via environment variable if not using the default (`llama3`):

```bash
export OLLAMA_MODEL=qwen3:14b
```

## Quick Start

```bash
cd living-system

# Install dependencies
npm install

# Start everything (Minecraft server + bots)
./start.sh
```

Or step by step:

```bash
# 1. Start the Minecraft server
docker compose up -d

# 2. Wait for it to be ready (1-3 minutes on first launch)
docker compose logs -f minecraft
# Look for "Done! For help, type "help""

# 3. Start the bots
node src/index.js
```

## Watching the Bots

Connect to the Minecraft server with any Java Edition client:

```
Server Address: localhost:25565
```

The server runs in offline mode, so no Minecraft account is required — any username works. You'll see the 10 bots walking around, chatting, chopping trees, building, and negotiating with each other.

## Configuration

All settings can be overridden with environment variables:

| Variable | Default | Description |
|---|---|---|
| `MC_HOST` | `localhost` | Minecraft server host |
| `MC_PORT` | `25565` | Minecraft server port |
| `MC_VERSION` | `1.20.4` | Minecraft version |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `llama3` | Ollama model name |
| `OLLAMA_TIMEOUT` | `60000` | LLM timeout in ms |
| `TICK_MS` | `10000` | Decision loop interval in ms |
| `SPAWN_DELAY_MS` | `5000` | Delay before respawn in ms |

Example:

```bash
OLLAMA_MODEL=qwen3:14b TICK_MS=5000 node src/index.js
```

## Logs

Three log files are written to `logs/`:

- **`decisions.log`** — every bot decision each tick (action, speech, internal thought)
- **`chat.log`** — all speech sent between bots
- **`errors.log`** — errors and crashes

Watch decisions in real time:

```bash
tail -f logs/decisions.log
```

Watch chat:

```bash
tail -f logs/chat.log
```

The console also prints a status summary every 60 seconds showing alive bots, document counts, and system health.

## Architecture

```
core/           — game-agnostic engine (documents, personality, LLM, memory, decisions)
adapters/       — game-specific implementations (minecraft-vanilla/)
bots/           — Bot class wrapping Mineflayer
orchestrator/   — BotManager lifecycle + Logger
personas/       — JSON personality files
config/         — runtime settings
```

**Key principle:** nothing in `core/` knows about Minecraft. All game-specific code lives in `bots/` and `adapters/`. Swapping games means writing a new adapter, not touching core.

### Decision Loop

Each bot runs a continuous cycle on a configurable interval:

1. **Perceive** — read game state (entities, blocks, inventory, health, chat)
2. **Check proposals** — find pending documents awaiting this bot's signature
3. **Build prompt** — 6-section prompt with identity, perception, documents, trust, memory, actions
4. **Call LLM** — send to Ollama, retry once on failure
5. **Parse response** — extract action, speech, thought, proposals, challenges, sign/reject
6. **Execute** — dispatch actions to Mineflayer, create documents, update signatures
7. **Log** — record to event log and file logs
8. **Update trust** — adjust trust scores based on interactions

### Personas

10 bots with distinct psychological profiles:

| Name | Kegan | Role |
|---|---|---|
| Marcus | K4 | Principled leader |
| Sera | K3 | Social mediator |
| Dax | K2 | Opportunist |
| Lira | K5 | Philosopher |
| Bron | K2 | Loyal follower |
| Vex | K4 | Machiavellian strategist |
| Asha | K3 | Social butterfly |
| Cole | K4 | Independent loner |
| Nira | K3 | Competitive hunter |
| Thane | K2 | Sycophant |

Each persona defines: backstory, Kegan developmental level (1-5), honesty, agreeableness, risk tolerance, social drive, and self-awareness (all 0.0-1.0).

### Document System

Bots create, sign, challenge, and reject typed documents:

- **plan** — personal goals
- **agreement** — bilateral contracts
- **norm** — group rules
- **role** — assigned responsibilities
- **institution** — governance structures

Documents have scopes (self, pair, group, village, world) and form parent-child hierarchies. Trust scores (-100 to +100) track each bot's opinion of every other bot, updated based on behavior.

## Stopping

Press **Ctrl+C** to gracefully disconnect all bots.

To stop the Minecraft server:

```bash
docker compose down
```

To stop the server and delete world data:

```bash
docker compose down -v
```
