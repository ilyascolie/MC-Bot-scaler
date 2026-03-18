'use strict';

const skills = require('./skills');

/**
 * Gather wood: find trees, chop, collect drops.
 */
async function gatherWood(bot) {
  try {
    const block = await skills.chopTrees(bot);
    if (!block) return false;
    // Wait for drops to settle, then try to collect
    await new Promise(r => setTimeout(r, 500));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Hunt: find an animal, attack, collect drops.
 */
async function hunt(bot) {
  try {
    const animalNames = ['cow', 'pig', 'sheep', 'chicken', 'rabbit'];
    let target = null;
    for (const entity of Object.values(bot.entities)) {
      if (entity === bot.entity) continue;
      if (animalNames.includes(entity.name) && entity.position) {
        target = entity;
        break;
      }
    }
    if (!target) return false;
    await skills.attack(bot, target.name);
    await new Promise(r => setTimeout(r, 500));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Build shelter: gather materials if needed, then build walls.
 */
async function buildShelter(bot) {
  try {
    const buildingBlocks = bot.inventory.items().filter(i =>
      ['cobblestone', 'dirt', 'oak_planks', 'spruce_planks', 'stone'].includes(i.name)
    );
    // If no building materials, try to gather wood first
    if (buildingBlocks.length === 0) {
      await gatherWood(bot);
    }
    return await skills.buildShelter(bot);
  } catch (err) {
    return false;
  }
}

/**
 * Explore: wander in a direction, note what's found.
 */
async function explore(bot) {
  try {
    await skills.wander(bot);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Forage: mine + store cycle.
 */
async function forage(bot) {
  try {
    // Try to mine something useful
    const oreTypes = ['coal_ore', 'iron_ore', 'copper_ore'];
    for (const ore of oreTypes) {
      try {
        const block = await skills.mine(bot, ore);
        if (block) {
          // Try to store it
          try {
            await skills.store(bot, ore.replace('_ore', ''));
          } catch (err) {
            // No chest nearby, that's fine
          }
          return true;
        }
      } catch (err) {
        // Try next ore type
      }
    }
    return false;
  } catch (err) {
    return false;
  }
}

module.exports = {
  gatherWood,
  hunt,
  buildShelter,
  explore,
  forage,
};
