const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder');

/**
 * MinecraftConnection — creates a Mineflayer bot and loads plugins.
 *
 * Handles the low-level connection to a Minecraft server, plugin
 * registration, and reconnection logic.
 */

/**
 * Create and configure a Mineflayer bot for the given persona.
 *
 * @param {object} opts
 * @param {string} opts.host     — Minecraft server hostname
 * @param {number} opts.port     — Minecraft server port (default 25565)
 * @param {string} opts.username — bot's in-game username
 * @param {string} [opts.version] — Minecraft version string
 * @returns {Promise<import('mineflayer').Bot>} connected bot instance
 */
async function createBot({ host, port, username, version }) {
  // TODO: create mineflayer.createBot with options
  // TODO: load pathfinder, pvp, collectblock plugins
  // TODO: wait for 'spawn' event before resolving
  // TODO: set up reconnection on 'end' / 'kicked' events
  throw new Error('createBot() not implemented');
}

/**
 * Gracefully disconnect a bot.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<void>}
 */
async function disconnectBot(bot) {
  // TODO: bot.quit() with reason
  throw new Error('disconnectBot() not implemented');
}

module.exports = { createBot, disconnectBot };
