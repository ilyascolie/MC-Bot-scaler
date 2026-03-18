'use strict';

const NOTABLE_BLOCK_TYPES = [
  'iron_ore', 'gold_ore', 'diamond_ore', 'coal_ore', 'copper_ore',
  'chest', 'crafting_table', 'furnace', 'oak_log', 'spruce_log', 'birch_log',
];

/**
 * Read nearby entities within a given radius.
 */
function readNearbyEntities(bot, maxDistance = 32, maxCount = 20) {
  const pos = bot.entity.position;
  return Object.values(bot.entities)
    .filter(e => e !== bot.entity && e.position && e.position.distanceTo(pos) <= maxDistance)
    .map(e => ({
      name: e.username || e.name || e.displayName || 'unknown',
      type: e.type === 'player' ? 'player' : (e.type === 'mob' ? (e.mobType || 'mob') : e.type || 'entity'),
      distance: Math.round(e.position.distanceTo(pos)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxCount);
}

/**
 * Scan nearby blocks using spatial sampling (not brute force).
 */
function readNearbyBlocks(bot, notableTypes = NOTABLE_BLOCK_TYPES) {
  const pos = bot.entity.position;
  const nearbyBlocks = [];
  const checked = new Set();

  for (let dx = -16; dx <= 16; dx += 4) {
    for (let dy = -8; dy <= 8; dy += 4) {
      for (let dz = -16; dz <= 16; dz += 4) {
        const blockPos = pos.offset(dx, dy, dz).floored();
        const key = `${blockPos.x},${blockPos.y},${blockPos.z}`;
        if (checked.has(key)) continue;
        checked.add(key);
        try {
          const block = bot.blockAt(blockPos);
          if (block && notableTypes.includes(block.name) && !nearbyBlocks.includes(block.name)) {
            nearbyBlocks.push(block.name);
          }
        } catch (err) {
          // Ignore block read errors
        }
      }
    }
  }

  return nearbyBlocks;
}

/**
 * Read inventory items.
 */
function readInventory(bot) {
  return bot.inventory.items().map(i => ({ name: i.name, count: i.count }));
}

/**
 * Get time of day as a human-readable string.
 */
function getTimeOfDay(bot) {
  const time = bot.time?.timeOfDay || 0;
  if (time < 6000) return 'morning';
  if (time < 12000) return 'afternoon';
  if (time < 13000) return 'sunset';
  return 'night';
}

/**
 * Build a complete perception state from the bot.
 */
function buildPerception(bot, chatBuffer) {
  if (!bot || !bot.entity) {
    return {
      nearbyEntities: [], nearbyBlocks: [], inventory: [],
      health: 0, food: 0, timeOfDay: 'unknown', dayCount: 0, recentChat: [],
    };
  }

  return {
    nearbyEntities: readNearbyEntities(bot),
    nearbyBlocks: readNearbyBlocks(bot),
    inventory: readInventory(bot),
    health: Math.round(bot.health),
    food: Math.round(bot.food),
    timeOfDay: getTimeOfDay(bot),
    dayCount: Math.floor((bot.time?.age || 0) / 24000),
    recentChat: [...(chatBuffer || [])],
  };
}

module.exports = {
  readNearbyEntities,
  readNearbyBlocks,
  readInventory,
  getTimeOfDay,
  buildPerception,
  NOTABLE_BLOCK_TYPES,
};
