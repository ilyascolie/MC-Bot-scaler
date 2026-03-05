const fs = require('fs');
const path = require('path');
const settings = require('../config/settings');
const DocumentStore = require('./core/documents/store');
const EventLog = require('./core/memory/event-log');
const OllamaClient = require('./core/llm/client');
const BotManager = require('./orchestrator/bot-manager');
const Logger = require('./orchestrator/logger');

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

  const llmClient = new OllamaClient({
    baseUrl: settings.llm.baseUrl,
    model: settings.llm.model,
    timeoutMs: settings.llm.timeoutMs,
  });

  const logger = new Logger({ logDir: settings.paths.logs });
  logger.init();
  console.log(`  Logs: ${settings.paths.logs}`);

  // ── 3. Check LLM health ──
  console.log(`\nChecking Ollama at ${settings.llm.baseUrl} (model: ${settings.llm.model})...`);
  const llmOk = await llmClient.healthCheck();
  if (llmOk) {
    console.log('  Ollama is ready.');
  } else {
    console.error('  WARNING: Ollama health check failed!');
    console.error('  Bots will idle until Ollama is available.');
    console.error(`  Make sure Ollama is running and has model "${settings.llm.model}" pulled.`);
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
  });

  // ── 5. Spawn all bots ──
  await manager.spawnAll(1000);

  // ── 6. Status summary every 60 seconds ──
  const statusInterval = setInterval(() => {
    printStatus(manager, store);
  }, 60000);

  // ── 7. Graceful shutdown ──
  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n\nReceived ${signal}. Shutting down gracefully...\n`);
    logger.info(`Shutdown initiated by ${signal}`);

    clearInterval(statusInterval);
    manager.stopAll();
    store.close();
    logger.close();

    console.log('Goodbye.\n');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Print initial status
  printStatus(manager, store);

  console.log('Press Ctrl+C to stop.\n');
}

/**
 * Print a status summary to the console.
 *
 * @param {import('./orchestrator/bot-manager')} manager
 * @param {import('./core/documents/store')} store
 */
function printStatus(manager, store) {
  const status = manager.getStatus();

  console.log('\n--- Status ---');
  console.log(`  Bots alive: ${status.alive}/${status.total}`);

  if (status.bots.length > 0) {
    for (const bot of status.bots) {
      const state = bot.alive ? 'ALIVE' : 'DEAD';
      console.log(`    ${bot.name} (K${bot.kegan}): ${state}`);
    }
  }

  // Document counts by type
  try {
    const docCounts = {};
    const allBotIds = status.bots.map((b) => b.id);
    const seen = new Set();
    for (const botId of allBotIds) {
      const docs = store.getDocumentsForBot(botId);
      for (const doc of docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        docCounts[doc.type] = (docCounts[doc.type] || 0) + 1;
      }
    }
    if (Object.keys(docCounts).length > 0) {
      console.log('  Documents:');
      for (const [type, count] of Object.entries(docCounts)) {
        console.log(`    ${type}: ${count}`);
      }
    }
  } catch {
    // DB may be closed during shutdown
  }

  console.log('--------------\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
