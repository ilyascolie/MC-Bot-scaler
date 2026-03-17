'use strict';

const { goals } = require('mineflayer-pathfinder');
const mcData = require('minecraft-data');
const { Vec3 } = require('vec3');

async function idle() {
  await new Promise(r => setTimeout(r, 500));
}

async function wander(bot) {
  try {
    const pos = bot.entity.position;
    const dx = (Math.random() - 0.5) * 20;
    const dz = (Math.random() - 0.5) * 20;
    const target = pos.offset(dx, 0, dz);
    await bot.pathfinder.goto(new goals.GoalNear(target.x, target.y, target.z, 2));
  } catch (err) {
    // Wander failures are non-critical
  }
}

async function goTo(bot, params) {
  try {
    const [x, y, z] = params.map(Number);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;
    await bot.pathfinder.goto(new goals.GoalNear(x, y, z, 2));
  } catch (err) {
    throw new Error(`GO_TO failed: ${err.message}`);
  }
}

async function follow(bot, name) {
  try {
    const entity = findPlayer(bot, name);
    if (!entity) return;
    const goal = new goals.GoalFollow(entity, 3);
    bot.pathfinder.setGoal(goal);
    await new Promise(r => setTimeout(r, 5000));
    bot.pathfinder.setGoal(null);
  } catch (err) {
    throw new Error(`FOLLOW failed: ${err.message}`);
  }
}

async function flee(bot, name) {
  try {
    const entity = findPlayer(bot, name);
    if (!entity) {
      await wander(bot);
      return;
    }
    const goal = new goals.GoalInvert(new goals.GoalFollow(entity, 3));
    bot.pathfinder.setGoal(goal);
    await new Promise(r => setTimeout(r, 5000));
    bot.pathfinder.setGoal(null);
  } catch (err) {
    throw new Error(`FLEE failed: ${err.message}`);
  }
}

async function mine(bot, blockType) {
  try {
    if (!blockType) return;
    const block = bot.findBlock({
      matching: (b) => b.name === blockType,
      maxDistance: 32,
    });
    if (!block) return null;
    await bot.pathfinder.goto(new goals.GoalGetToBlock(block.position.x, block.position.y, block.position.z));
    await bot.dig(block);
    return block;
  } catch (err) {
    throw new Error(`MINE failed: ${err.message}`);
  }
}

async function chopTrees(bot) {
  try {
    const logTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
    const block = bot.findBlock({
      matching: (b) => logTypes.includes(b.name),
      maxDistance: 32,
    });
    if (!block) return null;
    await bot.pathfinder.goto(new goals.GoalGetToBlock(block.position.x, block.position.y, block.position.z));
    await bot.dig(block);
    return block;
  } catch (err) {
    throw new Error(`CHOP_TREES failed: ${err.message}`);
  }
}

async function eat(bot) {
  try {
    const foodNames = ['bread', 'cooked_beef', 'cooked_chicken', 'cooked_porkchop', 'apple',
      'golden_apple', 'baked_potato', 'cooked_mutton', 'cooked_salmon', 'cooked_cod'];
    const foodItems = bot.inventory.items().filter(i => foodNames.includes(i.name));
    if (foodItems.length === 0) return false;
    await bot.equip(foodItems[0], 'hand');
    await bot.consume();
    return true;
  } catch (err) {
    throw new Error(`EAT failed: ${err.message}`);
  }
}

async function buildShelter(bot) {
  try {
    const pos = bot.entity.position.floored();
    const blocks = bot.inventory.items().filter(i =>
      ['cobblestone', 'dirt', 'oak_planks', 'spruce_planks', 'stone'].includes(i.name)
    );
    if (blocks.length === 0) return false;
    const offsets = [
      [-1, 0, -1], [0, 0, -1], [1, 0, -1],
      [-1, 0, 1], [0, 0, 1], [1, 0, 1],
      [-1, 0, 0], [1, 0, 0],
    ];
    for (const [dx, dy, dz] of offsets) {
      try {
        const placePos = pos.offset(dx, dy, dz);
        const refBlock = bot.blockAt(placePos.offset(0, -1, 0));
        if (refBlock) {
          await bot.equip(blocks[0], 'hand');
          await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
        }
      } catch (err) {
        // Continue placing other blocks even if one fails
      }
    }
    return true;
  } catch (err) {
    throw new Error(`BUILD_SHELTER failed: ${err.message}`);
  }
}

async function place(bot, params) {
  try {
    const [type, x, y, z] = params;
    if (!type) return;
    const item = bot.inventory.items().find(i => i.name === type);
    if (!item) return;
    await bot.equip(item, 'hand');
    if (x && y && z) {
      const target = new Vec3(Number(x), Number(y) - 1, Number(z));
      const refBlock = bot.blockAt(target);
      if (refBlock) {
        await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
      }
    }
  } catch (err) {
    throw new Error(`PLACE failed: ${err.message}`);
  }
}

async function craft(bot, itemName) {
  try {
    if (!itemName) return;
    const data = mcData(bot.version);
    const item = data.itemsByName[itemName];
    if (!item) return null;
    const recipes = bot.recipesFor(item.id);
    if (recipes.length === 0) return null;
    const recipe = recipes[0];
    if (recipe.requiresTable) {
      const table = bot.findBlock({
        matching: (b) => b.name === 'crafting_table',
        maxDistance: 32,
      });
      if (table) {
        await bot.pathfinder.goto(new goals.GoalGetToBlock(table.position.x, table.position.y, table.position.z));
        await bot.craft(recipe, 1, table);
      }
    } else {
      await bot.craft(recipe, 1);
    }
    return item;
  } catch (err) {
    throw new Error(`CRAFT failed: ${err.message}`);
  }
}

async function store(bot, itemName) {
  try {
    const chest = bot.findBlock({
      matching: (b) => b.name === 'chest',
      maxDistance: 32,
    });
    if (!chest) return false;
    await bot.pathfinder.goto(new goals.GoalGetToBlock(chest.position.x, chest.position.y, chest.position.z));
    const container = await bot.openContainer(chest);
    const item = bot.inventory.items().find(i => i.name === itemName);
    if (item) {
      await container.deposit(item.type, null, item.count);
    }
    container.close();
    return true;
  } catch (err) {
    throw new Error(`STORE failed: ${err.message}`);
  }
}

async function retrieve(bot, itemName) {
  try {
    const chest = bot.findBlock({
      matching: (b) => b.name === 'chest',
      maxDistance: 32,
    });
    if (!chest) return false;
    await bot.pathfinder.goto(new goals.GoalGetToBlock(chest.position.x, chest.position.y, chest.position.z));
    const container = await bot.openContainer(chest);
    const item = container.containerItems().find(i => i.name === itemName);
    if (item) {
      await container.withdraw(item.type, null, item.count);
    }
    container.close();
    return true;
  } catch (err) {
    throw new Error(`RETRIEVE failed: ${err.message}`);
  }
}

async function attack(bot, name) {
  try {
    const entity = findEntity(bot, name);
    if (!entity) return false;
    await bot.pathfinder.goto(new goals.GoalFollow(entity, 2));
    bot.pvp.attack(entity);
    await new Promise(r => setTimeout(r, 3000));
    bot.pvp.stop();
    return true;
  } catch (err) {
    throw new Error(`ATTACK failed: ${err.message}`);
  }
}

function findPlayer(bot, name) {
  if (!name) return null;
  return bot.players[name]?.entity || null;
}

function findEntity(bot, name) {
  if (!name) return null;
  const player = findPlayer(bot, name);
  if (player) return player;
  for (const entity of Object.values(bot.entities)) {
    if ((entity.username || entity.name || entity.displayName) === name) return entity;
  }
  return null;
}

module.exports = {
  idle,
  wander,
  goTo,
  follow,
  flee,
  mine,
  chopTrees,
  eat,
  buildShelter,
  place,
  craft,
  store,
  retrieve,
  attack,
  findPlayer,
  findEntity,
};
