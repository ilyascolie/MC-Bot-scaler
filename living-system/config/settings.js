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

  /** Ollama LLM settings */
  llm: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3',
    timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
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
