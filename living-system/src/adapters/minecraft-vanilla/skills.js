/**
 * MinecraftSkills — maps action names to Mineflayer API calls.
 *
 * Each skill is an atomic operation: mine a block, attack an entity,
 * go to a position, eat food, etc. Skills are the building blocks
 * that abilities.js composes into multi-step behaviours.
 */

/**
 * @typedef {object} SkillResult
 * @property {boolean} success
 * @property {string}  [message] — human-readable status
 */

/**
 * Registry of available atomic skills.
 * Keys are action names used in LLM decisions.
 *
 * @type {Record<string, (bot: import('mineflayer').Bot, params: object) => Promise<SkillResult>>}
 */
const SKILLS = {
  /**
   * Move to a position using pathfinder.
   * @param {object} params — { x, y, z }
   */
  goto: async (bot, params) => {
    // TODO: use pathfinder to navigate to params.x, params.y, params.z
    throw new Error('skill:goto not implemented');
  },

  /**
   * Follow a player by username.
   * @param {object} params — { target: string }
   */
  follow: async (bot, params) => {
    // TODO: find player entity, pathfind toward them
    throw new Error('skill:follow not implemented');
  },

  /**
   * Mine the nearest block of a given type.
   * @param {object} params — { blockType: string }
   */
  mine: async (bot, params) => {
    // TODO: find nearest block of type, equip best tool, dig
    throw new Error('skill:mine not implemented');
  },

  /**
   * Attack the nearest hostile or named entity.
   * @param {object} params — { target: string }
   */
  attack: async (bot, params) => {
    // TODO: find entity, use pvp plugin to attack
    throw new Error('skill:attack not implemented');
  },

  /**
   * Eat food from inventory.
   * @param {object} params — { foodName?: string }
   */
  eat: async (bot, params) => {
    // TODO: find food in inventory, equip and activate
    throw new Error('skill:eat not implemented');
  },

  /**
   * Place a block from inventory.
   * @param {object} params — { blockType: string, position: {x,y,z} }
   */
  place: async (bot, params) => {
    // TODO: find block in inventory, navigate to position, place
    throw new Error('skill:place not implemented');
  },

  /**
   * Do nothing for the current tick.
   */
  idle: async (bot, params) => {
    return { success: true, message: 'Idling.' };
  },
};

/**
 * Execute a named skill.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} skillName
 * @param {object} params
 * @returns {Promise<SkillResult>}
 */
async function executeSkill(bot, skillName, params) {
  const skill = SKILLS[skillName];
  if (!skill) {
    return { success: false, message: `Unknown skill: ${skillName}` };
  }
  return skill(bot, params);
}

/**
 * List all registered skill names.
 * @returns {string[]}
 */
function listSkills() {
  return Object.keys(SKILLS);
}

module.exports = { SKILLS, executeSkill, listSkills };
