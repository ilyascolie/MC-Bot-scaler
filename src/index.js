'use strict';

const settings = require('../config/settings');
const DocumentStore = require('./core/documents/store');
const LLMClient = require('./core/llm/client');
const Logger = require('./orchestrator/logger');
const ConversationLogger = require('./logging/conversation-logger');
const Dashboard = require('./logging/dashboard');
const BotManager = require('./orchestrator/bot-manager');

async function main() {
  console.log('=== Living System v0.1.0 ===\n');

  // Initialize document store
  const store = new DocumentStore(settings.paths.database);
  console.log('Document store initialized');

  // Initialize LLM client
  const llmClient = new LLMClient(settings.llm);
  try {
    const healthy = await llmClient.healthCheck();
    if (healthy) {
      console.log(`LLM provider (${settings.llm.provider}) is healthy`);
    } else {
      console.warn(`WARNING: LLM provider (${settings.llm.provider}) health check failed — bots will fall back to IDLE`);
    }
  } catch (err) {
    console.warn(`WARNING: LLM health check error: ${err.message} — bots will fall back to IDLE`);
  }

  // Initialize logging
  const logger = new Logger(settings.paths.logs);
  const conversationLogger = new ConversationLogger(settings.paths.logs);

  // Initialize bot manager
  const manager = new BotManager({
    store, llmClient, logger, conversationLogger,
    settings,
  });

  // Initialize dashboard
  const dashboard = new Dashboard(manager);
  manager.dashboard = dashboard;

  // Spawn all bots
  console.log('\nSpawning bots...');
  await manager.spawnAll();

  // Start dashboard
  dashboard.start(30000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    dashboard.stop();
    await manager.stopAll();
    conversationLogger.close();
    logger.close();
    store.close();
    console.log('Clean shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`\nLiving System running — ${manager.listRunning().length} bots active`);
  console.log('Press Ctrl+C to stop\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
