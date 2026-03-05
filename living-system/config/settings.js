const path = require('path');

/**
 * Central configuration for the living-system.
 *
 * Override with environment variables where noted.
 */
module.exports = {
  /** Minecraft server connection */
  minecraft: {
    host: process.env.MC_HOST || 'localhost',
    port: parseInt(process.env.MC_PORT || '25565', 10),
    version: process.env.MC_VERSION || '1.20.4',
  },

  /**
   * LLM settings — provider-aware with tiered model support.
   *
   * provider: 'anthropic' | 'ollama' | 'vllm'
   * routine:   { model } — fast/cheap model for normal decision ticks
   * strategic: { model } — smarter model for proposals, challenges, K4+ bots
   *
   * Set LLM_PROVIDER to switch providers. Falls back to Ollama for backwards compat.
   */
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    apiKey: process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    endpoint: process.env.LLM_ENDPOINT || '',
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1024', 10),
    timeoutMs: parseInt(process.env.LLM_TIMEOUT || '60000', 10),
    routine: {
      model: process.env.LLM_ROUTINE_MODEL || process.env.OLLAMA_MODEL || 'llama3',
    },
    strategic: {
      model: process.env.LLM_STRATEGIC_MODEL || '',
    },
  },

  /** Decision loop timing */
  loop: {
    tickMs: parseInt(process.env.TICK_MS || '10000', 10),
    spawnDelayMs: parseInt(process.env.SPAWN_DELAY_MS || '5000', 10),
  },

  /** Paths */
  paths: {
    data: path.resolve(__dirname, '..', 'data'),
    logs: path.resolve(__dirname, '..', 'logs'),
    personas: path.resolve(__dirname, '..', 'personas'),
    db: path.resolve(__dirname, '..', 'data', 'living-system.db'),
  },

  /** Memory */
  memory: {
    eventLogSize: 100,
  },

  /** Dashboard */
  dashboard: {
    enabled: process.env.DASHBOARD !== 'false',
  },
};
