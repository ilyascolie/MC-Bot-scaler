/**
 * MinecraftAbilities — composed multi-step skill chains.
 *
 * Abilities are higher-level behaviours built from atomic skills.
 * For example, "gather wood" = goto(nearest tree) → mine(log) → collect(items).
 * These give the LLM richer action options without requiring it to
 * plan every micro-step.
 */

const { executeSkill } = require('./skills');

/**
 * @typedef {object} AbilityResult
 * @property {boolean} success
 * @property {string}  message
 * @property {string[]} stepsCompleted — which sub-skills ran
 */

/**
 * Gather wood: find nearest tree, go to it, mine logs.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {object} params — { count?: number }
 * @returns {Promise<AbilityResult>}
 */
async function gatherWood(bot, params = {}) {
  // TODO: find nearest oak/birch/spruce log
  // TODO: goto(log position)
  // TODO: mine(log) × count
  // TODO: collect dropped items
  throw new Error('ability:gatherWood not implemented');
}

/**
 * Hunt animals: find nearest passive mob, go to it, attack, collect drops.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {object} params — { mobType?: string }
 * @returns {Promise<AbilityResult>}
 */
async function hunt(bot, params = {}) {
  // TODO: find nearest cow/pig/sheep/chicken
  // TODO: goto → attack → collect
  throw new Error('ability:hunt not implemented');
}

/**
 * Build a simple shelter: place blocks in a box shape.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {object} params — { material?: string }
 * @returns {Promise<AbilityResult>}
 */
async function buildShelter(bot, params = {}) {
  // TODO: check inventory for building blocks
  // TODO: place walls, roof in a simple pattern
  throw new Error('ability:buildShelter not implemented');
}

/**
 * Explore: walk in a direction, scanning for interesting features.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {object} params — { direction?: string, distance?: number }
 * @returns {Promise<AbilityResult>}
 */
async function explore(bot, params = {}) {
  // TODO: pick a direction, pathfind a moderate distance
  throw new Error('ability:explore not implemented');
}

/** Registry of all abilities. */
const ABILITIES = {
  gatherWood,
  hunt,
  buildShelter,
  explore,
};

/**
 * Execute a named ability.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} abilityName
 * @param {object} params
 * @returns {Promise<AbilityResult>}
 */
async function executeAbility(bot, abilityName, params) {
  const ability = ABILITIES[abilityName];
  if (!ability) {
    return { success: false, message: `Unknown ability: ${abilityName}`, stepsCompleted: [] };
  }
  return ability(bot, params);
}

module.exports = { ABILITIES, executeAbility };
