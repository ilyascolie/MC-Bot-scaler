'use strict';

const EventEmitter = require('events');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const collectBlock = require('mineflayer-collectblock').plugin;
const mcData = require('minecraft-data');
const { Vec3 } = require('vec3');
const EventLog = require('../core/memory/event-log');

class Bot extends EventEmitter {
  constructor(persona, serverConfig) {
    super();
    this.persona = persona;
    this.serverConfig = serverConfig;
    this.bot = null;   // mineflayer instance
    this.eventLog = new EventLog(20);
    this.chatBuffer = [];
    this.chatBufferSize = 5;
    this._alive = false;
    this._connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, val) => {
        if (settled) return;
        settled = true;
        fn(val);
      };

      this.bot = mineflayer.createBot({
        host: this.serverConfig.host,
        port: this.serverConfig.port,
        username: this.persona.name,
        version: this.serverConfig.version || '1.20.4',
        auth: 'offline',
      });

      this.bot.loadPlugin(pathfinder);
      this.bot.loadPlugin(pvp);
      this.bot.loadPlugin(collectBlock);

      this.bot.once('spawn', () => {
        const data = mcData(this.bot.version);
        const movements = new Movements(this.bot, data);
        movements.canDig = true;
        movements.allowParkour = true;
        this.bot.pathfinder.setMovements(movements);
        this._alive = true;
        this._connected = true;
        settle(resolve);
      });

      this.bot.on('chat', (username, message) => {
        if (username === this.persona.name) return;
        this.chatBuffer.push({ sender: username, message, tick: Date.now() });
        if (this.chatBuffer.length > this.chatBufferSize) this.chatBuffer.shift();
        this.eventLog.push({ type: 'chat', data: `${username}: ${message}` });
      });

      this.bot.on('entitySpawn', (entity) => {
        try {
          if (entity.type === 'hostile' && entity.position.distanceTo(this.bot.entity.position) < 16) {
            this.eventLog.push({ type: 'threat', data: `${entity.name || 'hostile mob'} appeared nearby` });
          }
        } catch (err) {
          // Ignore errors from entity spawn handling
        }
      });

      this.bot.on('health', () => {
        if (this.bot.health <= 5) {
          this.eventLog.push({ type: 'danger', data: `Health critical: ${this.bot.health}/20` });
        }
      });

      this.bot.on('death', () => {
        this._alive = false;
        this.eventLog.push({ type: 'death', data: 'You died.' });
        this.emit('death', this.persona.id);
      });

      this.bot.on('kicked', (reason) => {
        this._alive = false;
        this._connected = false;
        this.eventLog.push({ type: 'kicked', data: reason });
        this.emit('kicked', this.persona.id, reason);
      });

      this.bot.on('error', (err) => {
        this.eventLog.push({ type: 'error', data: err.message });
        if (!this._connected) {
          // During connection phase, reject the promise
          settle(reject, err);
        } else if (this.listenerCount('error') > 0) {
          this.emit('error', this.persona.id, err);
        }
      });

      this.bot.on('end', (reason) => {
        this._alive = false;
        this._connected = false;
        if (!settled) {
          settle(reject, new Error(`Connection ended: ${reason || 'unknown'}`));
        }
      });

      setTimeout(() => {
        settle(reject, new Error('Connection timeout'));
      }, 30000);
    });
  }

  isAlive() { return this._alive; }
  isConnected() { return this._connected; }

  /**
   * Read game state into a PerceptionState object.
   */
  perceive() {
    if (!this.bot || !this._alive) return this._emptyPerception();

    const pos = this.bot.entity.position;

    // Nearby entities within 32 blocks
    const nearbyEntities = Object.values(this.bot.entities)
      .filter(e => e !== this.bot.entity && e.position && e.position.distanceTo(pos) <= 32)
      .map(e => ({
        name: e.username || e.name || e.displayName || 'unknown',
        type: e.type === 'player' ? 'player' : (e.type === 'mob' ? (e.mobType || 'mob') : e.type || 'entity'),
        distance: Math.round(e.position.distanceTo(pos)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    // Notable blocks within 16 blocks (ores, chests, crafting, furnaces)
    const notableTypes = ['iron_ore', 'gold_ore', 'diamond_ore', 'coal_ore', 'copper_ore',
      'chest', 'crafting_table', 'furnace', 'oak_log', 'spruce_log', 'birch_log'];
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
            const block = this.bot.blockAt(blockPos);
            if (block && notableTypes.includes(block.name) && !nearbyBlocks.includes(block.name)) {
              nearbyBlocks.push(block.name);
            }
          } catch (err) {
            // Ignore block read errors
          }
        }
      }
    }

    return {
      nearbyEntities,
      nearbyBlocks,
      inventory: this.bot.inventory.items().map(i => ({ name: i.name, count: i.count })),
      health: Math.round(this.bot.health),
      food: Math.round(this.bot.food),
      timeOfDay: this._getTimeOfDay(),
      dayCount: Math.floor((this.bot.time?.age || 0) / 24000),
      recentChat: [...this.chatBuffer],
    };
  }

  _emptyPerception() {
    return {
      nearbyEntities: [], nearbyBlocks: [], inventory: [],
      health: 0, food: 0, timeOfDay: 'unknown', dayCount: 0, recentChat: [],
    };
  }

  _getTimeOfDay() {
    const time = this.bot.time?.timeOfDay || 0;
    if (time < 6000) return 'morning';
    if (time < 12000) return 'afternoon';
    if (time < 13000) return 'sunset';
    return 'night';
  }

  /**
   * Execute a parsed action from the LLM.
   * action: { ability: 'MINE', params: ['iron_ore'] }
   */
  async executeAction(action) {
    if (!action || !this.bot || !this._alive) return;
    const { ability, params } = action;
    try {
      switch (ability) {
        case 'IDLE':
          await this._idle();
          break;
        case 'WANDER':
          await this._wander();
          break;
        case 'GO_TO':
          await this._goTo(params);
          break;
        case 'FOLLOW':
          await this._follow(params[0]);
          break;
        case 'FLEE':
          await this._flee(params[0]);
          break;
        case 'MINE':
          await this._mine(params[0]);
          break;
        case 'CHOP_TREES':
          await this._chopTrees();
          break;
        case 'EAT':
          await this._eat();
          break;
        case 'BUILD_SHELTER':
          await this._buildShelter();
          break;
        case 'PLACE':
          await this._place(params);
          break;
        case 'CRAFT':
          await this._craft(params[0]);
          break;
        case 'STORE':
          await this._store(params[0]);
          break;
        case 'RETRIEVE':
          await this._retrieve(params[0]);
          break;
        case 'ATTACK':
          await this._attack(params[0]);
          break;
        default:
          this.eventLog.push({ type: 'warning', data: `Unknown action: ${ability}` });
      }
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `${ability} failed: ${err.message}` });
    }
  }

  // === Action Implementations ===

  async _idle() {
    // Do nothing for one tick
    await new Promise(r => setTimeout(r, 500));
  }

  async _wander() {
    try {
      const pos = this.bot.entity.position;
      const dx = (Math.random() - 0.5) * 20;
      const dz = (Math.random() - 0.5) * 20;
      const target = pos.offset(dx, 0, dz);
      await this.bot.pathfinder.goto(new goals.GoalNear(target.x, target.y, target.z, 2));
    } catch (err) {
      // Wander failures are non-critical
    }
  }

  async _goTo(params) {
    try {
      const [x, y, z] = params.map(Number);
      if (isNaN(x) || isNaN(y) || isNaN(z)) return;
      await this.bot.pathfinder.goto(new goals.GoalNear(x, y, z, 2));
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `GO_TO failed: ${err.message}` });
    }
  }

  async _follow(name) {
    try {
      const entity = this._findPlayer(name);
      if (!entity) return;
      const goal = new goals.GoalFollow(entity, 3);
      this.bot.pathfinder.setGoal(goal);
      await new Promise(r => setTimeout(r, 5000));
      this.bot.pathfinder.setGoal(null);
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `FOLLOW failed: ${err.message}` });
    }
  }

  async _flee(name) {
    try {
      const entity = this._findPlayer(name);
      if (!entity) {
        // Flee from nearest hostile
        await this._wander();
        return;
      }
      const goal = new goals.GoalInvert(new goals.GoalFollow(entity, 3));
      this.bot.pathfinder.setGoal(goal);
      await new Promise(r => setTimeout(r, 5000));
      this.bot.pathfinder.setGoal(null);
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `FLEE failed: ${err.message}` });
    }
  }

  async _mine(blockType) {
    try {
      if (!blockType) return;
      const block = this.bot.findBlock({
        matching: (b) => b.name === blockType,
        maxDistance: 32,
      });
      if (!block) {
        this.eventLog.push({ type: 'info', data: `No ${blockType} found nearby` });
        return;
      }
      await this.bot.pathfinder.goto(new goals.GoalGetToBlock(block.position.x, block.position.y, block.position.z));
      await this.bot.dig(block);
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `MINE failed: ${err.message}` });
    }
  }

  async _chopTrees() {
    try {
      const logTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
      const block = this.bot.findBlock({
        matching: (b) => logTypes.includes(b.name),
        maxDistance: 32,
      });
      if (!block) {
        this.eventLog.push({ type: 'info', data: 'No trees found nearby' });
        return;
      }
      await this.bot.pathfinder.goto(new goals.GoalGetToBlock(block.position.x, block.position.y, block.position.z));
      await this.bot.dig(block);
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `CHOP_TREES failed: ${err.message}` });
    }
  }

  async _eat() {
    try {
      const foodItems = this.bot.inventory.items().filter(i =>
        ['bread', 'cooked_beef', 'cooked_chicken', 'cooked_porkchop', 'apple', 'golden_apple', 'baked_potato', 'cooked_mutton', 'cooked_salmon', 'cooked_cod'].includes(i.name)
      );
      if (foodItems.length === 0) {
        this.eventLog.push({ type: 'info', data: 'No food in inventory' });
        return;
      }
      await this.bot.equip(foodItems[0], 'hand');
      await this.bot.consume();
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `EAT failed: ${err.message}` });
    }
  }

  async _buildShelter() {
    try {
      // Simple 3x3x3 walls around the bot
      const pos = this.bot.entity.position.floored();
      const blocks = this.bot.inventory.items().filter(i =>
        ['cobblestone', 'dirt', 'oak_planks', 'spruce_planks', 'stone'].includes(i.name)
      );
      if (blocks.length === 0) {
        this.eventLog.push({ type: 'info', data: 'No building blocks in inventory' });
        return;
      }
      // Place blocks in a simple ring
      const offsets = [
        [-1, 0, -1], [0, 0, -1], [1, 0, -1],
        [-1, 0, 1], [0, 0, 1], [1, 0, 1],
        [-1, 0, 0], [1, 0, 0],
      ];
      for (const [dx, dy, dz] of offsets) {
        try {
          const placePos = pos.offset(dx, dy, dz);
          const refBlock = this.bot.blockAt(placePos.offset(0, -1, 0));
          if (refBlock) {
            await this.bot.equip(blocks[0], 'hand');
            await this.bot.placeBlock(refBlock, new Vec3(0, 1, 0));
          }
        } catch (err) {
          // Continue placing other blocks even if one fails
        }
      }
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `BUILD_SHELTER failed: ${err.message}` });
    }
  }

  async _place(params) {
    try {
      const [type, x, y, z] = params;
      if (!type) return;
      const item = this.bot.inventory.items().find(i => i.name === type);
      if (!item) return;
      await this.bot.equip(item, 'hand');
      if (x && y && z) {
        const target = new Vec3(Number(x), Number(y) - 1, Number(z));
        const refBlock = this.bot.blockAt(target);
        if (refBlock) {
          await this.bot.placeBlock(refBlock, new Vec3(0, 1, 0));
        }
      }
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `PLACE failed: ${err.message}` });
    }
  }

  async _craft(itemName) {
    try {
      if (!itemName) return;
      const data = mcData(this.bot.version);
      const item = data.itemsByName[itemName];
      if (!item) {
        this.eventLog.push({ type: 'info', data: `Unknown item: ${itemName}` });
        return;
      }
      const recipes = this.bot.recipesFor(item.id);
      if (recipes.length === 0) {
        this.eventLog.push({ type: 'info', data: `No recipe for ${itemName}` });
        return;
      }
      // Check if we need a crafting table
      const recipe = recipes[0];
      if (recipe.requiresTable) {
        const table = this.bot.findBlock({
          matching: (b) => b.name === 'crafting_table',
          maxDistance: 32,
        });
        if (table) {
          await this.bot.pathfinder.goto(new goals.GoalGetToBlock(table.position.x, table.position.y, table.position.z));
          await this.bot.craft(recipe, 1, table);
        } else {
          this.eventLog.push({ type: 'info', data: `Need crafting table for ${itemName}` });
        }
      } else {
        await this.bot.craft(recipe, 1);
      }
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `CRAFT failed: ${err.message}` });
    }
  }

  async _store(itemName) {
    try {
      const chest = this.bot.findBlock({
        matching: (b) => b.name === 'chest',
        maxDistance: 32,
      });
      if (!chest) {
        this.eventLog.push({ type: 'info', data: 'No chest found nearby' });
        return;
      }
      await this.bot.pathfinder.goto(new goals.GoalGetToBlock(chest.position.x, chest.position.y, chest.position.z));
      const container = await this.bot.openContainer(chest);
      const item = this.bot.inventory.items().find(i => i.name === itemName);
      if (item) {
        await container.deposit(item.type, null, item.count);
      }
      container.close();
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `STORE failed: ${err.message}` });
    }
  }

  async _retrieve(itemName) {
    try {
      const chest = this.bot.findBlock({
        matching: (b) => b.name === 'chest',
        maxDistance: 32,
      });
      if (!chest) return;
      await this.bot.pathfinder.goto(new goals.GoalGetToBlock(chest.position.x, chest.position.y, chest.position.z));
      const container = await this.bot.openContainer(chest);
      const item = container.containerItems().find(i => i.name === itemName);
      if (item) {
        await container.withdraw(item.type, null, item.count);
      }
      container.close();
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `RETRIEVE failed: ${err.message}` });
    }
  }

  async _attack(name) {
    try {
      const entity = this._findEntity(name);
      if (!entity) {
        this.eventLog.push({ type: 'info', data: `Cannot find ${name} to attack` });
        return;
      }
      await this.bot.pathfinder.goto(new goals.GoalFollow(entity, 2));
      this.bot.pvp.attack(entity);
      await new Promise(r => setTimeout(r, 3000));
      this.bot.pvp.stop();
    } catch (err) {
      this.eventLog.push({ type: 'action_error', data: `ATTACK failed: ${err.message}` });
    }
  }

  /**
   * Observe other bots' activities (for agreement violation detection).
   */
  observeOtherBots() {
    if (!this.bot || !this._alive) return [];
    const pos = this.bot.entity.position;
    const observations = [];

    for (const entity of Object.values(this.bot.entities)) {
      if (entity === this.bot.entity) continue;
      if (entity.type !== 'player') continue;
      if (!entity.position || entity.position.distanceTo(pos) > 16) continue;

      // Infer activity from entity state
      let activity = 'idle';
      if (entity.velocity && (Math.abs(entity.velocity.x) > 0.1 || Math.abs(entity.velocity.z) > 0.1)) {
        activity = 'moving';
      }
      // Check if entity metadata shows arm swinging (fighting)
      if (entity.metadata && entity.metadata[0] !== undefined) {
        // Simplified: check for hand swinging
        activity = activity === 'moving' ? 'moving' : 'idle';
      }

      const obs = {
        name: entity.username || entity.name || 'unknown',
        distance: Math.round(entity.position.distanceTo(pos)),
        activity,
        inventory: null, // Can't see other player inventories
        talkingTo: null,
      };

      // Check recent chat to see who they're talking to
      for (const msg of this.chatBuffer) {
        if (msg.sender === obs.name) {
          obs.talkingTo = 'someone';
          break;
        }
      }

      observations.push(obs);
    }

    return observations;
  }

  speak(text, target) {
    if (!this.bot || !this._alive) return;
    if (target) {
      this.bot.chat(`@${target} ${text}`);
    } else {
      this.bot.chat(text);
    }
  }

  async disconnect() {
    this._alive = false;
    this._connected = false;
    if (this.bot) {
      this.bot.quit();
      this.bot = null;
    }
  }

  _findPlayer(name) {
    if (!name) return null;
    return this.bot.players[name]?.entity || null;
  }

  _findEntity(name) {
    if (!name) return null;
    // Try player first
    const player = this._findPlayer(name);
    if (player) return player;
    // Then try any entity
    for (const entity of Object.values(this.bot.entities)) {
      if ((entity.username || entity.name || entity.displayName) === name) return entity;
    }
    return null;
  }
}

module.exports = Bot;
