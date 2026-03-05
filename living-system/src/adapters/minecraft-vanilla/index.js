const AdapterInterface = require('../adapter-interface');
const { createBot, disconnectBot } = require('./connection');
const { perceive } = require('./perception');
const { executeSkill, listSkills } = require('./skills');
const { executeAbility } = require('./abilities');
const { getMeaningContext } = require('./meaning');

/**
 * MinecraftVanillaAdapter — implements AdapterInterface for vanilla Minecraft
 * via Mineflayer.
 */
class MinecraftVanillaAdapter extends AdapterInterface {
  /**
   * @param {object} config
   * @param {string} config.host — Minecraft server host
   * @param {number} config.port — Minecraft server port
   * @param {string} [config.version] — Minecraft version
   */
  constructor({ host, port, version }) {
    super();
    this.host = host;
    this.port = port;
    this.version = version;
  }

  /** @override */
  async connect(persona) {
    // TODO: call createBot with server config + persona.name as username
    throw new Error('MinecraftVanillaAdapter.connect() not implemented');
  }

  /** @override */
  async perceive(bot) {
    // TODO: delegate to perception.perceive(bot)
    throw new Error('MinecraftVanillaAdapter.perceive() not implemented');
  }

  /** @override */
  async execute(bot, action) {
    // TODO: try executeSkill first, fall back to executeAbility
    throw new Error('MinecraftVanillaAdapter.execute() not implemented');
  }

  /** @override */
  async speak(bot, message, target = null) {
    // TODO: bot.chat(message) or bot.whisper(target, message)
    throw new Error('MinecraftVanillaAdapter.speak() not implemented');
  }

  /** @override */
  getMeaningContext() {
    return getMeaningContext();
  }

  /** @override */
  async disconnect(bot) {
    // TODO: delegate to disconnectBot(bot)
    throw new Error('MinecraftVanillaAdapter.disconnect() not implemented');
  }

  /**
   * List all available action names (skills + abilities).
   * @returns {string[]}
   */
  getAvailableActions() {
    // TODO: merge listSkills() + Object.keys(ABILITIES)
    throw new Error('MinecraftVanillaAdapter.getAvailableActions() not implemented');
  }
}

module.exports = MinecraftVanillaAdapter;
