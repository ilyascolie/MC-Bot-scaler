const path = require('path');
const settings = require('../config/settings');
const DocumentStore = require('./core/documents/store');
const TrustTracker = require('./core/memory/trust');
const EventLog = require('./core/memory/event-log');
const LLMClient = require('./core/llm/client');
const MinecraftVanillaAdapter = require('./adapters/minecraft-vanilla');
const BotManager = require('./orchestrator/bot-manager');
const Logger = require('./orchestrator/logger');

/**
 * Entry point — wires everything together and starts the system.
 *
 * 1. Load config
 * 2. Initialise shared services (DB, LLM client, logger)
 * 3. Create adapter
 * 4. Create BotManager
 * 5. Spawn bots
 * 6. Handle graceful shutdown
 */

async function main() {
  // TODO: initialise DocumentStore with data/ path
  // TODO: initialise TrustTracker with same DB
  // TODO: create EventLog instance
  // TODO: create LLMClient from settings
  // TODO: create MinecraftVanillaAdapter from settings
  // TODO: create Logger, call init()
  // TODO: create BotManager with all deps
  // TODO: call botManager.spawnAll()
  // TODO: register SIGINT/SIGTERM handlers for graceful shutdown
  console.log('living-system: entry point stub — not yet implemented');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
