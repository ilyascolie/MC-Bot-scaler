const Bot = require('../bots/bot');
const { loadPersona, listPersonas } = require('../core/personality/persona');
const { startDecisionLoop } = require('../core/decisions/decision-loop');

/**
 * BotManager — spawns bots, manages their lifecycle and decision loops.
 *
 * Responsible for:
 *   - Loading persona files
 *   - Creating Bot instances with staggered spawning
 *   - Starting a decision loop per bot
 *   - Handling bot deaths (log, stop loop, optionally respawn)
 *   - Providing status info
 */

class BotManager {
  /**
   * @param {object} deps
   * @param {import('../core/llm/client')}        deps.llmClient
   * @param {import('../core/documents/store')}    deps.store
   * @param {import('../core/memory/event-log')}   deps.eventLog
   * @param {import('./logger')}                   deps.logger
   * @param {object}  deps.serverConfig — { host, port, version }
   * @param {number}  [deps.tickMs=5000]
   * @param {boolean} [deps.autoRespawn=true]
   * @param {number}  [deps.respawnDelayMs=10000]
   */
  constructor({ llmClient, store, eventLog, logger, serverConfig, tickMs = 5000, autoRespawn = true, respawnDelayMs = 10000 }) {
    this.llmClient = llmClient;
    this.store = store;
    this.eventLog = eventLog;
    this.logger = logger;
    this.serverConfig = serverConfig;
    this.tickMs = tickMs;
    this.autoRespawn = autoRespawn;
    this.respawnDelayMs = respawnDelayMs;

    /** @type {Map<string, { bot: Bot, intervalId: NodeJS.Timeout, persona: object }>} */
    this.bots = new Map();

    /** Stats tracking */
    this.stats = {
      llmCalls: 0,
      totalDecisionTimeMs: 0,
      decisionCount: 0,
    };
  }

  /**
   * Spawn a single bot from a persona name.
   *
   * @param {string} personaName — filename without .json
   * @returns {Promise<Bot>}
   */
  async spawnBot(personaName) {
    const persona = loadPersona(personaName);
    const bot = new Bot(persona, this.serverConfig);

    console.log(`  Connecting ${persona.name}...`);
    this.logger.info(`Spawning bot: ${persona.name} (${persona.id})`);

    try {
      await bot.connect();
    } catch (err) {
      console.error(`  Failed to connect ${persona.name}: ${err.message}`);
      this.logger.logError(persona.name, err);
      throw err;
    }

    console.log(`  ${persona.name} spawned!`);

    // Start decision loop
    const intervalId = startDecisionLoop(bot, this.store, {
      llmClient: this.llmClient,
      eventLog: this.eventLog,
      tickMs: this.tickMs,
    });

    this.bots.set(persona.id, { bot, intervalId, persona });

    // Handle death
    bot.on('bot-died', (botId) => {
      this._handleDeath(botId);
    });

    return bot;
  }

  /**
   * Spawn all personas found in the personas/ directory, with staggered starts.
   *
   * @param {number} [delayMs=1000] — delay between each spawn
   * @returns {Promise<void>}
   */
  async spawnAll(delayMs = 1000) {
    const names = listPersonas();
    console.log(`\nSpawning ${names.length} bots (${delayMs}ms between each)...\n`);
    this.logger.info(`Spawning ${names.length} bots with ${delayMs}ms stagger`);

    for (let i = 0; i < names.length; i++) {
      try {
        await this.spawnBot(names[i]);
      } catch (err) {
        console.error(`  Skipping ${names[i]}: ${err.message}`);
      }

      // Stagger: wait before next spawn (skip after last)
      if (i < names.length - 1) {
        await this._sleep(delayMs);
      }
    }

    console.log(`\n${this.bots.size}/${names.length} bots online.\n`);
    this.logger.info(`${this.bots.size}/${names.length} bots online`);
  }

  /**
   * Stop a single bot by id.
   *
   * @param {string} botId
   */
  stopBot(botId) {
    const entry = this.bots.get(botId);
    if (!entry) return;

    clearInterval(entry.intervalId);
    entry.bot.disconnect();
    this.bots.delete(botId);

    console.log(`  ${entry.persona.name} stopped.`);
    this.logger.info(`Bot stopped: ${entry.persona.name}`);
  }

  /**
   * Stop all bots gracefully.
   */
  stopAll() {
    console.log(`\nStopping ${this.bots.size} bots...`);
    for (const [botId] of this.bots) {
      this.stopBot(botId);
    }
    console.log('All bots stopped.');
  }

  /**
   * Handle a bot death — stop its loop, optionally respawn.
   *
   * @param {string} botId
   * @private
   */
  _handleDeath(botId) {
    const entry = this.bots.get(botId);
    if (!entry) return;

    const name = entry.persona.name;
    console.log(`  ${name} died!`);
    this.logger.logError(name, 'Bot died');

    // Stop the decision loop
    clearInterval(entry.intervalId);

    if (this.autoRespawn) {
      console.log(`  ${name} will respawn in ${this.respawnDelayMs / 1000}s...`);
      this.logger.info(`${name} will respawn in ${this.respawnDelayMs}ms`);

      setTimeout(async () => {
        // Remove old entry
        this.bots.delete(botId);

        try {
          await this.spawnBot(entry.persona.id);
          console.log(`  ${name} respawned!`);
        } catch (err) {
          console.error(`  ${name} respawn failed: ${err.message}`);
          this.logger.logError(name, err);
        }
      }, this.respawnDelayMs);
    } else {
      this.bots.delete(botId);
    }
  }

  /**
   * Get status summary of all bots.
   *
   * @returns {{ alive: number, total: number, bots: Array<{ name: string, alive: boolean }> }}
   */
  getStatus() {
    const bots = [];
    let alive = 0;

    for (const [, entry] of this.bots) {
      const isAlive = entry.bot.isAlive();
      if (isAlive) alive++;
      bots.push({
        name: entry.persona.name,
        id: entry.persona.id,
        alive: isAlive,
        kegan: entry.persona.kegan_level,
      });
    }

    return { alive, total: this.bots.size, bots };
  }

  /**
   * Get the names of all currently running bots.
   * @returns {string[]}
   */
  listRunning() {
    return Array.from(this.bots.values())
      .filter((e) => e.bot.isAlive())
      .map((e) => e.persona.name);
  }

  /** @private */
  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = BotManager;
