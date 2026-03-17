'use strict';

const Bot = require('../bots/bot');
const { loadPersona, listPersonas } = require('../core/personality/persona');
const { startDecisionLoop } = require('../core/decisions/decision-loop');

class BotManager {
  constructor({ store, llmClient, logger, conversationLogger, dashboard, settings }) {
    this.store = store;
    this.llmClient = llmClient;
    this.logger = logger;
    this.conversationLogger = conversationLogger;
    this.dashboard = dashboard;
    this.settings = settings;
    this.bots = new Map();        // id -> Bot
    this.intervals = new Map();   // id -> intervalId
  }

  async spawnBot(personaName) {
    const persona = loadPersona(personaName);
    const bot = new Bot(persona, this.settings.minecraft);

    try {
      await bot.connect();
    } catch (err) {
      this.logger.logError(`Failed to connect ${persona.name}: ${err.message}`);
      return null;
    }

    this.bots.set(persona.id, bot);

    const intervalId = startDecisionLoop(bot, this.store, {
      llmClient: this.llmClient,
      tickMs: this.settings.bot.tickMs,
      conversationLogger: this.conversationLogger,
      dashboard: this.dashboard,
    });
    this.intervals.set(persona.id, intervalId);

    bot.on('death', (botId) => this._handleDeath(botId));
    bot.on('kicked', (botId, reason) => {
      this.logger.logError(`${persona.name} kicked: ${reason}`);
      this.stopBot(botId);
    });
    bot.on('error', (botId, err) => {
      this.logger.logError(`${persona.name} error: ${err.message}`);
    });

    this.logger.info(`${persona.name} (K${persona.kegan_level}) connected and running`);
    return bot;
  }

  async spawnAll(delayMs) {
    const names = listPersonas();
    const delay = delayMs || this.settings.bot.spawnDelayMs || 1000;

    for (const name of names) {
      await this.spawnBot(name);
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }

    this.logger.info(`All ${this.bots.size} bots spawned`);
  }

  stopBot(botId) {
    const intervalId = this.intervals.get(botId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(botId);
    }
    const bot = this.bots.get(botId);
    if (bot) {
      bot.disconnect();
      this.bots.delete(botId);
    }
  }

  async stopAll() {
    for (const [id] of this.bots) {
      this.stopBot(id);
    }
    this.logger.info('All bots stopped');
  }

  _handleDeath(botId) {
    const bot = this.bots.get(botId);
    const name = bot?.persona?.name || botId;
    this.logger.info(`${name} died — will respawn in ${this.settings.bot.respawnDelayMs / 1000}s`);
    if (this.dashboard) this.dashboard.addEvent(`${name} died`);
    if (this.conversationLogger) this.conversationLogger.logEvent(`${name} died and will respawn`);

    // Stop current loop
    const intervalId = this.intervals.get(botId);
    if (intervalId) clearInterval(intervalId);
    this.intervals.delete(botId);

    // Respawn after delay
    setTimeout(async () => {
      if (!this.bots.has(botId)) return;
      try {
        const persona = bot.persona;
        this.bots.delete(botId);
        await this.spawnBot(persona.id);
        this.logger.info(`${name} respawned`);
        if (this.dashboard) this.dashboard.addEvent(`${name} respawned`);
      } catch (err) {
        this.logger.logError(`Failed to respawn ${name}: ${err.message}`);
      }
    }, this.settings.bot.respawnDelayMs || 10000);
  }

  getStatus() {
    const status = [];
    for (const [id, bot] of this.bots) {
      status.push({
        id,
        name: bot.persona.name,
        alive: bot.isAlive(),
        kegan: bot.persona.kegan_level,
      });
    }
    return {
      alive: status.filter(s => s.alive).length,
      total: status.length,
      bots: status,
    };
  }

  listRunning() {
    return [...this.bots.values()].filter(b => b.isAlive()).map(b => b.persona.name);
  }
}

module.exports = BotManager;
