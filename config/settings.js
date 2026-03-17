'use strict';

const settings = {
  minecraft: {
    host: process.env.MC_HOST || 'localhost',
    port: parseInt(process.env.MC_PORT || '25565'),
    version: '1.20.4',
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    endpoint: process.env.LLM_ENDPOINT || 'http://localhost:11434',
    apiKey: process.env.LLM_API_KEY || '',
    routine: {
      model: process.env.LLM_ROUTINE_MODEL || 'qwen2.5:8b',
    },
    strategic: {
      model: process.env.LLM_STRATEGIC_MODEL || 'qwen2.5:32b',
    },
    temperature: 0.7,
    timeoutMs: 30000,
  },
  bot: {
    tickMs: parseInt(process.env.BOT_TICK_MS || '4000'),
    perceptionRange: 32,
    chatBufferSize: 5,
    eventLogSize: 20,
    spawnDelayMs: 1000,
    respawnDelayMs: 10000,
  },
  paths: {
    personas: './personas',
    database: process.env.DB_PATH || './data/living-system.db',
    logs: './logs',
  },
};

module.exports = settings;
