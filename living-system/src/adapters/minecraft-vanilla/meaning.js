/**
 * MinecraftMeaning — what game objects mean, for prompt context.
 *
 * Provides natural-language descriptions of Minecraft concepts so the
 * LLM understands the world it is acting in. This is injected into the
 * prompt as "meaning context" and is the key bridge between raw game
 * state and the LLM's ability to reason about it.
 */

/**
 * Get the full meaning context string for Minecraft.
 * Describes the game world, survival mechanics, items, mobs, and
 * social norms so the LLM can make informed decisions.
 *
 * @returns {string} — multi-paragraph natural language description
 */
function getMeaningContext() {
  // TODO: write comprehensive game meaning description covering:
  // - What Minecraft is (survival sandbox)
  // - Day/night cycle and its implications
  // - Health, hunger, and how they work
  // - Hostile mobs and when they spawn
  // - Common resources and what they're used for
  // - Crafting and building basics
  // - Social norms (trading, cooperation, conflict)
  throw new Error('getMeaningContext() not implemented');
}

/**
 * Get a short description of what a specific item or block means.
 *
 * @param {string} name — Minecraft item/block name (e.g. 'diamond_sword')
 * @returns {string|null} — human-readable description or null if unknown
 */
function describeItem(name) {
  // TODO: lookup table of common items with descriptions
  throw new Error('describeItem() not implemented');
}

/**
 * Get a short description of what a mob type means.
 *
 * @param {string} mobType — e.g. 'zombie', 'cow', 'player'
 * @returns {string|null}
 */
function describeMob(mobType) {
  // TODO: lookup table of mob types with threat level, behaviour
  throw new Error('describeMob() not implemented');
}

module.exports = { getMeaningContext, describeItem, describeMob };
