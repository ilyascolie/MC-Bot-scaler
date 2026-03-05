/**
 * MinecraftPerception — reads Mineflayer game state into a
 * game-agnostic PerceptionState object.
 *
 * Translates Minecraft-specific data (bot.entity, bot.players,
 * bot.inventory, etc.) into the generic format that core/ expects.
 */

/**
 * Build a PerceptionState from the current Mineflayer bot state.
 *
 * @param {import('mineflayer').Bot} bot — connected Mineflayer bot
 * @returns {import('../../adapters/adapter-interface').PerceptionState}
 */
function perceive(bot) {
  // TODO: extract bot.entity.position → { x, y, z }
  // TODO: extract bot.health / 20 → normalised health
  // TODO: extract bot.food / 20 → normalised hunger
  // TODO: scan nearby entities within radius → nearbyEntities[]
  // TODO: extract bot.players → nearbyPlayers[]
  // TODO: map bot.inventory.items() → human-readable strings
  // TODO: collect recent chat from bot.chat event buffer → recentChat[]
  throw new Error('perceive() not implemented');
}

/**
 * Get a list of blocks near the bot.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} [radius=16]
 * @returns {string[]} — block type names
 */
function nearbyBlocks(bot, radius = 16) {
  // TODO: bot.findBlocks() within radius, return unique type names
  throw new Error('nearbyBlocks() not implemented');
}

module.exports = { perceive, nearbyBlocks };
