'use strict';

const AdapterInterface = require('../adapter-interface');
const { createBot } = require('./connection');
const { getMeaningContext } = require('./meaning');
const { buildPerception } = require('./perception');
const skills = require('./skills');
const abilities = require('./abilities');

class MinecraftVanillaAdapter extends AdapterInterface {
  constructor() {
    super();
    this.bot = null;
    this.chatBuffer = [];
  }

  async connect(persona, serverConfig) {
    this.bot = createBot(persona, serverConfig);
    return this.bot;
  }

  async disconnect() {
    if (this.bot) {
      this.bot.quit();
      this.bot = null;
    }
  }

  perceive() {
    if (!this.bot) return null;
    return buildPerception(this.bot, this.chatBuffer);
  }

  async executeAction(action) {
    if (!this.bot || !action) return;
    const fn = skills[action.ability.toLowerCase()];
    if (fn) {
      await fn(this.bot, ...(action.params || []));
    }
  }

  speak(text, target) {
    if (!this.bot) return;
    if (target) {
      this.bot.chat(`@${target} ${text}`);
    } else {
      this.bot.chat(text);
    }
  }

  getMeaningContext(perception) {
    return getMeaningContext(perception);
  }

  get skills() { return skills; }
  get abilities() { return abilities; }
}

module.exports = MinecraftVanillaAdapter;
