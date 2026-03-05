const fs = require('fs');
const path = require('path');
const settings = require('../config/settings');
const DocumentStore = require('./core/documents/store');
const EventLog = require('./core/memory/event-log');
const LLMClient = require('./core/llm/client');
const BotManager = require('./orchestrator/bot-manager');
const Logger = require('./orchestrator/logger');
const ConversationLogger = require('./logging/conversation-logger');
const Dashboard = require('./logging/dashboard');

/**
 * Entry point — wires everything together and starts the system.
 *
 * 1. Initialize SQLite database
 * 2. Initialize shared services (LLM client, event log, logger)
 * 3. Create BotManager
 * 4. Spawn all bots with staggered timing
 * 5. Start status summary interval
 * 6. Handle graceful shutdown
 */

async function main() {
  console.log('=== living-system ===\n');

  // ── Ensure data directory exists ──
  fs.mkdirSync(settings.paths.data, { recursive: true });

  // ── 1. Initialize SQLite database ──
  console.log('Initializing database...');
  const store = new DocumentStore(settings.paths.db);
  store.init();
  console.log(`  Database: ${settings.paths.db}`);

  // ── 2. Initialize shared services ──
  const eventLog = new EventLog(settings.memory.eventLogSize);

  const llmClient = new LLMClient(settings.llm);

  const logger = new Logger({ logDir: settings.paths.logs });
  logger.init();
  console.log(`  Logs: ${settings.paths.logs}`);

  const conversationLogger = new ConversationLogger({ logDir: settings.paths.logs });
  conversationLogger.init();
  console.log(`  Narrative logs: ${settings.paths.logs}/narrative/`);

  // ── 3. Check LLM health ──
  const routineModel = settings.llm.routine.model;
  console.log(`\nChecking LLM provider "${settings.llm.provider}" (model: ${routineModel})...`);
  const llmOk = await llmClient.healthCheck();
  if (llmOk) {
    console.log('  LLM provider is ready.');
  } else {
    console.error('  WARNING: LLM health check failed!');
    console.error('  Bots will idle until the LLM provider is available.');
  }

  // ── 4. Create BotManager ──
  const manager = new BotManager({
    llmClient,
    store,
    eventLog,
    logger,
    serverConfig: settings.minecraft,
    tickMs: settings.loop.tickMs,
    autoRespawn: true,
    respawnDelayMs: settings.loop.spawnDelayMs,
    conversationLogger,
  });

  // ── 5. Spawn all bots ──
  await manager.spawnAll(1000);

  // ── 6. Dashboard (replaces old printStatus interval) ──
  const dashboard = new Dashboard({
    manager,
    store,
    intervalMs: 30000,
  });

  // Wire dashboard into bot manager so new bots get it too
  manager.dashboard = dashboard;

  dashboard.start();

  // ── 7. Graceful shutdown ──
  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n\nReceived ${signal}. Shutting down gracefully...\n`);
    logger.info(`Shutdown initiated by ${signal}`);

    dashboard.stop();
    manager.stopAll();
    store.close();
    logger.close();
    conversationLogger.close();

    console.log('Goodbye.\n');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('Press Ctrl+C to stop.\n');
  console.log('Narrative logs: tail -f logs/narrative/day-*.log\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
