const DecisionLoop = require('../core/decisions/decision-loop');
const { loadPersona, listPersonas } = require('../core/personality/persona');

/**
 * BotManager — spawns bots, manages their lifecycle.
 *
 * Responsible for:
 *   - Loading persona files
 *   - Creating DecisionLoop instances per bot
 *   - Starting / stopping bots individually or all at once
 *   - Staggering bot spawns to avoid server overload
 */

class BotManager {
  /**
   * @param {object} deps
   * @param {import('../adapters/adapter-interface')} deps.adapter
   * @param {import('../core/llm/client')}            deps.llmClient
   * @param {import('../core/documents/store')}       deps.documentStore
   * @param {import('../core/memory/trust')}          deps.trustTracker
   * @param {import('../core/memory/event-log')}      deps.eventLog
   * @param {object}  deps.config — settings from config/settings.js
   */
  constructor({ adapter, llmClient, documentStore, trustTracker, eventLog, config }) {
    this.adapter = adapter;
    this.llmClient = llmClient;
    this.documentStore = documentStore;
    this.trustTracker = trustTracker;
    this.eventLog = eventLog;
    this.config = config;

    /** @type {Map<string, DecisionLoop>} */
    this.bots = new Map();
  }

  /**
   * Spawn a single bot from a persona name.
   *
   * @param {string} personaName — filename without .json
   * @returns {Promise<void>}
   */
  async spawnBot(personaName) {
    // TODO: loadPersona(personaName)
    // TODO: create DecisionLoop with all deps
    // TODO: call loop.start()
    // TODO: store in this.bots map
    throw new Error('BotManager.spawnBot() not implemented');
  }

  /**
   * Spawn all personas found in the personas/ directory, with staggered starts.
   *
   * @param {number} [delayMs=5000] — delay between each spawn
   * @returns {Promise<void>}
   */
  async spawnAll(delayMs = 5000) {
    // TODO: listPersonas(), spawn each with delay
    throw new Error('BotManager.spawnAll() not implemented');
  }

  /**
   * Stop a single bot by name.
   *
   * @param {string} botName
   * @returns {Promise<void>}
   */
  async stopBot(botName) {
    // TODO: get loop from map, call stop(), remove from map
    throw new Error('BotManager.stopBot() not implemented');
  }

  /**
   * Stop all bots gracefully.
   * @returns {Promise<void>}
   */
  async stopAll() {
    // TODO: iterate this.bots, stop each
    throw new Error('BotManager.stopAll() not implemented');
  }

  /**
   * Get the names of all currently running bots.
   * @returns {string[]}
   */
  listRunning() {
    return Array.from(this.bots.keys());
  }
}

module.exports = BotManager;
