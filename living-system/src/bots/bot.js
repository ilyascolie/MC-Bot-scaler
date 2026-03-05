const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const EventEmitter = require('events');

const { GoalNear, GoalBlock, GoalFollow, GoalInvert } = goals;

/**
 * Notable block types worth reporting in perception.
 * Ores, storage, crafting stations, and functional blocks.
 */
const NOTABLE_BLOCKS = new Set([
  'coal_ore', 'deepslate_coal_ore',
  'iron_ore', 'deepslate_iron_ore',
  'gold_ore', 'deepslate_gold_ore',
  'diamond_ore', 'deepslate_diamond_ore',
  'lapis_ore', 'deepslate_lapis_ore',
  'redstone_ore', 'deepslate_redstone_ore',
  'emerald_ore', 'deepslate_emerald_ore',
  'copper_ore', 'deepslate_copper_ore',
  'chest', 'trapped_chest', 'barrel',
  'crafting_table', 'furnace', 'blast_furnace', 'smoker',
  'anvil', 'enchanting_table', 'brewing_stand',
  'bed', 'white_bed', 'red_bed',
]);

/**
 * Bot — wraps a Mineflayer bot instance with persona, event log,
 * perception cache, and action dispatch.
 */
class Bot extends EventEmitter {
  /**
   * @param {import('../core/personality/persona').PersonaData} persona
   * @param {object} serverConfig
   * @param {string} serverConfig.host
   * @param {number} serverConfig.port
   * @param {string} [serverConfig.version]
   */
  constructor(persona, serverConfig) {
    super();
    this.persona = persona;
    this.serverConfig = serverConfig;

    /** @type {import('mineflayer').Bot|null} */
    this.mineflayerBot = null;

    /** Ring buffer of last 20 events */
    this.eventLog = [];
    this.maxEvents = 20;

    /** Recent chat messages (last 5) */
    this.recentChat = [];
    this.maxChat = 5;

    /** Cached perception state, refreshed each tick */
    this.perceptionCache = null;

    this._alive = false;
    this._spawned = false;
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Create the Mineflayer bot, load plugins, and register event handlers.
   * Resolves once the bot has spawned in the world.
   *
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      const opts = {
        host: this.serverConfig.host,
        port: this.serverConfig.port,
        username: this.persona.name,
        hideErrors: false,
      };
      if (this.serverConfig.version) opts.version = this.serverConfig.version;

      this.mineflayerBot = mineflayer.createBot(opts);
      const bot = this.mineflayerBot;

      // Load plugins
      bot.loadPlugin(pathfinder);
      bot.loadPlugin(pvp);

      // ── Spawn ──
      bot.once('spawn', () => {
        this._alive = true;
        this._spawned = true;

        // Configure pathfinder movements
        const mcData = require('minecraft-data')(bot.version);
        const defaultMove = new Movements(bot, mcData);
        defaultMove.allowSprinting = true;
        bot.pathfinder.setMovements(defaultMove);

        this.addEvent({ type: 'observation', summary: 'Spawned into the world' });
        resolve();
      });

      // ── Chat ──
      bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        this.recentChat.push({ sender: username, message, tick: Date.now() });
        if (this.recentChat.length > this.maxChat) this.recentChat.shift();
        this.addEvent({ type: 'chat', summary: `${username}: "${message}"` });
      });

      // ── Entity spawn ──
      bot.on('entitySpawn', (entity) => {
        if (!entity.position || !bot.entity) return;
        const dist = entity.position.distanceTo(bot.entity.position);
        if (dist <= 32 && entity.type === 'mob') {
          const name = entity.name || entity.displayName || 'unknown';
          this.addEvent({
            type: 'observation',
            summary: `${name} appeared ${Math.round(dist)} blocks away`,
          });
        }
      });

      // ── Health changes ──
      bot.on('health', () => {
        this.addEvent({
          type: 'observation',
          summary: `Health: ${bot.health}/20, Food: ${bot.food}/20`,
        });
      });

      // ── Death ──
      bot.on('death', () => {
        this._alive = false;
        this.addEvent({ type: 'observation', summary: 'Died' });
        this.emit('bot-died', this.persona.id);
      });

      // ── Respawn ──
      bot.on('spawn', () => {
        if (this._spawned) {
          this._alive = true;
          this.addEvent({ type: 'observation', summary: 'Respawned' });
        }
      });

      // ── Errors ──
      bot.on('error', (err) => {
        this.addEvent({ type: 'observation', summary: `Error: ${err.message}` });
      });

      bot.on('kicked', (reason) => {
        this._alive = false;
        this.addEvent({ type: 'observation', summary: `Kicked: ${reason}` });
        this.emit('bot-died', this.persona.id);
      });

      // Reject if connection fails before spawn
      bot.on('error', (err) => {
        if (!this._spawned) reject(err);
      });
    });
  }

  /**
   * Gracefully disconnect.
   */
  disconnect() {
    if (this.mineflayerBot) {
      this._alive = false;
      this.mineflayerBot.quit('Disconnecting');
      this.mineflayerBot = null;
    }
  }

  isAlive() {
    return this._alive;
  }

  // ─── Perception ─────────────────────────────────────────────

  /**
   * Snapshot the current game state into a game-agnostic PerceptionState.
   *
   * @returns {object} PerceptionState
   */
  perceive() {
    const bot = this.mineflayerBot;
    if (!bot || !bot.entity) {
      return this._emptyPerception();
    }

    // Nearby entities within 32 blocks
    const nearbyEntities = [];
    for (const entity of Object.values(bot.entities)) {
      if (entity === bot.entity) continue;
      if (!entity.position) continue;
      const dist = entity.position.distanceTo(bot.entity.position);
      if (dist > 32) continue;
      const name = entity.username
        || entity.displayName
        || entity.name
        || `${entity.type}`;
      nearbyEntities.push({
        name,
        type: entity.type || 'unknown',
        distance: Math.round(dist),
      });
    }
    nearbyEntities.sort((a, b) => a.distance - b.distance);

    // Notable blocks within 16 blocks
    const nearbyBlocks = [];
    const seen = new Set();
    try {
      const pos = bot.entity.position;
      for (let dx = -16; dx <= 16; dx += 2) {
        for (let dy = -8; dy <= 8; dy += 2) {
          for (let dz = -16; dz <= 16; dz += 2) {
            const block = bot.blockAt(pos.offset(dx, dy, dz));
            if (block && NOTABLE_BLOCKS.has(block.name) && !seen.has(block.name)) {
              seen.add(block.name);
              nearbyBlocks.push(block.name);
            }
          }
        }
      }
    } catch {
      // Chunks may not be loaded — safe to ignore
    }

    // Inventory
    const inventory = bot.inventory.items().map((item) => ({
      name: item.name,
      count: item.count,
    }));

    // Time
    const timeOfDay = bot.time.timeOfDay;
    const dayCount = bot.time.day;

    const perception = {
      nearbyEntities,
      nearbyBlocks,
      inventory,
      health: bot.health,
      food: bot.food,
      timeOfDay,
      dayCount,
      recentChat: this.recentChat.slice(-5),
    };

    this.perceptionCache = perception;
    return perception;
  }

  _emptyPerception() {
    return {
      nearbyEntities: [],
      nearbyBlocks: [],
      inventory: [],
      health: 0,
      food: 0,
      timeOfDay: 0,
      dayCount: 0,
      recentChat: [],
    };
  }

  // ─── Actions ────────────────────────────────────────────────

  /**
   * Dispatch a parsed action to the appropriate Mineflayer method.
   *
   * @param {{ability: string, params: string[]}} action
   * @returns {Promise<void>}
   */
  async executeAction(action) {
    if (!action) return;
    const bot = this.mineflayerBot;
    if (!bot || !this._alive) return;

    const name = action.ability.toUpperCase();
    const params = action.params || [];

    try {
      switch (name) {
        case 'IDLE':
          this.addEvent({ type: 'action', summary: 'Idling' });
          break;

        case 'WANDER':
          await this._wander(bot);
          break;

        case 'GO_TO':
          await this._goTo(bot, params);
          break;

        case 'FOLLOW':
          await this._follow(bot, params);
          break;

        case 'FLEE':
          await this._flee(bot, params);
          break;

        case 'MINE':
          await this._mine(bot, params);
          break;

        case 'ATTACK':
          await this._attack(bot, params);
          break;

        case 'EAT':
          await this._eat(bot);
          break;

        case 'CHOP_TREES':
          await this._chopTrees(bot);
          break;

        case 'BUILD_SHELTER':
          await this._buildShelter(bot);
          break;

        case 'CRAFT':
          await this._craft(bot, params);
          break;

        case 'STORE':
          await this._store(bot, params);
          break;

        case 'RETRIEVE':
          await this._retrieve(bot, params);
          break;

        case 'PLACE':
          await this._place(bot, params);
          break;

        default:
          this.addEvent({ type: 'action', summary: `Unknown action: ${name}` });
      }
    } catch (err) {
      this.addEvent({
        type: 'action',
        summary: `Action ${name} failed: ${err.message}`,
      });
    }
  }

  async _wander(bot) {
    const pos = bot.entity.position;
    const dx = Math.floor(Math.random() * 20) - 10;
    const dz = Math.floor(Math.random() * 20) - 10;
    const goal = new GoalNear(pos.x + dx, pos.y, pos.z + dz, 2);
    this.addEvent({ type: 'action', summary: `Wandering to offset (${dx}, ${dz})` });
    await bot.pathfinder.goto(goal);
  }

  async _goTo(bot, params) {
    const [x, y, z] = params.map(Number);
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      this.addEvent({ type: 'action', summary: 'GO_TO failed: invalid coordinates' });
      return;
    }
    this.addEvent({ type: 'action', summary: `Going to (${x}, ${y}, ${z})` });
    await bot.pathfinder.goto(new GoalBlock(x, y, z));
  }

  async _follow(bot, params) {
    const targetName = params[0];
    if (!targetName) {
      this.addEvent({ type: 'action', summary: 'FOLLOW failed: no target name' });
      return;
    }
    const entity = this._findEntityByName(bot, targetName);
    if (!entity) {
      this.addEvent({ type: 'action', summary: `FOLLOW failed: can't see ${targetName}` });
      return;
    }
    this.addEvent({ type: 'action', summary: `Following ${targetName}` });
    bot.pathfinder.setGoal(new GoalFollow(entity, 3), true);
    // Follow for a few seconds then stop
    await new Promise((r) => setTimeout(r, 5000));
    bot.pathfinder.stop();
  }

  async _flee(bot, params) {
    const targetName = params[0];
    if (!targetName) return;
    const entity = this._findEntityByName(bot, targetName);
    if (!entity) {
      this.addEvent({ type: 'action', summary: `FLEE: can't see ${targetName}, wandering away` });
      await this._wander(bot);
      return;
    }
    this.addEvent({ type: 'action', summary: `Fleeing from ${targetName}` });
    const invertedGoal = new GoalInvert(new GoalFollow(entity, 32));
    bot.pathfinder.setGoal(invertedGoal, true);
    await new Promise((r) => setTimeout(r, 4000));
    bot.pathfinder.stop();
  }

  async _mine(bot, params) {
    const blockType = params[0];
    if (!blockType) {
      this.addEvent({ type: 'action', summary: 'MINE failed: no block type specified' });
      return;
    }
    const mcData = require('minecraft-data')(bot.version);
    const blockId = mcData.blocksByName[blockType];
    if (!blockId) {
      this.addEvent({ type: 'action', summary: `MINE failed: unknown block ${blockType}` });
      return;
    }
    const block = bot.findBlock({
      matching: blockId.id,
      maxDistance: 32,
    });
    if (!block) {
      this.addEvent({ type: 'action', summary: `MINE failed: no ${blockType} nearby` });
      return;
    }
    this.addEvent({ type: 'action', summary: `Mining ${blockType}` });
    await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
    await bot.dig(block);
    this.addEvent({ type: 'action', summary: `Mined ${blockType}` });
  }

  async _attack(bot, params) {
    const targetName = params[0];
    if (!targetName) return;
    const entity = this._findEntityByName(bot, targetName);
    if (!entity) {
      this.addEvent({ type: 'action', summary: `ATTACK failed: can't see ${targetName}` });
      return;
    }
    this.addEvent({ type: 'action', summary: `Attacking ${targetName}` });
    await bot.pathfinder.goto(new GoalNear(
      entity.position.x, entity.position.y, entity.position.z, 2
    ));
    bot.attack(entity);
  }

  async _eat(bot) {
    const food = bot.inventory.items().find((item) => item.foodRecovery > 0);
    if (!food) {
      this.addEvent({ type: 'action', summary: 'EAT failed: no food in inventory' });
      return;
    }
    this.addEvent({ type: 'action', summary: `Eating ${food.name}` });
    await bot.equip(food, 'hand');
    await bot.consume();
    this.addEvent({ type: 'action', summary: `Ate ${food.name}` });
  }

  async _chopTrees(bot) {
    const mcData = require('minecraft-data')(bot.version);
    const logTypes = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
    let block = null;
    for (const logName of logTypes) {
      const logBlock = mcData.blocksByName[logName];
      if (!logBlock) continue;
      block = bot.findBlock({ matching: logBlock.id, maxDistance: 32 });
      if (block) break;
    }
    if (!block) {
      this.addEvent({ type: 'action', summary: 'CHOP_TREES failed: no trees nearby' });
      return;
    }
    this.addEvent({ type: 'action', summary: `Chopping ${block.name}` });
    await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
    await bot.dig(block);
    this.addEvent({ type: 'action', summary: `Chopped ${block.name}` });
  }

  async _buildShelter(bot) {
    const blocks = bot.inventory.items().filter((i) =>
      i.name.includes('plank') || i.name.includes('cobblestone') || i.name.includes('dirt')
    );
    if (blocks.length === 0) {
      this.addEvent({ type: 'action', summary: 'BUILD_SHELTER failed: no building blocks' });
      return;
    }
    this.addEvent({ type: 'action', summary: 'Building shelter' });
    const material = blocks[0];
    const pos = bot.entity.position.floored();

    // Place a simple 3x3x3 ring of blocks around the bot
    const offsets = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue; // don't block self
        for (let dy = 0; dy <= 2; dy++) {
          // Only walls (edges) and roof (dy=2)
          if (dy < 2 && Math.abs(dx) !== 1 && Math.abs(dz) !== 1) continue;
          offsets.push({ x: pos.x + dx, y: pos.y + dy, z: pos.z + dz });
        }
      }
    }

    let placed = 0;
    for (const off of offsets) {
      if (material.count <= 0) break;
      try {
        const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (!refBlock) continue;
        await bot.equip(material, 'hand');
        await bot.placeBlock(refBlock, { x: off.x - pos.x, y: off.y - pos.y + 1, z: off.z - pos.z });
        placed++;
      } catch {
        // Individual block placement can fail — keep going
      }
    }
    this.addEvent({ type: 'action', summary: `Built shelter (${placed} blocks placed)` });
  }

  async _craft(bot, params) {
    const itemName = params[0];
    if (!itemName) {
      this.addEvent({ type: 'action', summary: 'CRAFT failed: no item specified' });
      return;
    }
    const mcData = require('minecraft-data')(bot.version);
    const item = mcData.itemsByName[itemName];
    if (!item) {
      this.addEvent({ type: 'action', summary: `CRAFT failed: unknown item ${itemName}` });
      return;
    }
    // Find a crafting table nearby
    const craftingTable = bot.findBlock({
      matching: mcData.blocksByName['crafting_table']?.id,
      maxDistance: 32,
    });

    const recipes = bot.recipesFor(item.id, null, null, craftingTable);
    if (recipes.length === 0) {
      this.addEvent({ type: 'action', summary: `CRAFT failed: no recipe for ${itemName}` });
      return;
    }
    if (craftingTable) {
      await bot.pathfinder.goto(new GoalNear(
        craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 2
      ));
    }
    this.addEvent({ type: 'action', summary: `Crafting ${itemName}` });
    await bot.craft(recipes[0], 1, craftingTable);
    this.addEvent({ type: 'action', summary: `Crafted ${itemName}` });
  }

  async _store(bot, params) {
    const itemName = params[0];
    if (!itemName) return;
    const mcData = require('minecraft-data')(bot.version);
    const chest = bot.findBlock({
      matching: mcData.blocksByName['chest']?.id,
      maxDistance: 32,
    });
    if (!chest) {
      this.addEvent({ type: 'action', summary: 'STORE failed: no chest nearby' });
      return;
    }
    await bot.pathfinder.goto(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2));
    const chestWindow = await bot.openContainer(chest);
    const item = chestWindow.items().find((i) => i.name === itemName)
      || bot.inventory.items().find((i) => i.name === itemName);
    if (item) {
      await chestWindow.deposit(item.type, null, item.count);
      this.addEvent({ type: 'action', summary: `Stored ${item.count}x ${itemName}` });
    } else {
      this.addEvent({ type: 'action', summary: `STORE failed: ${itemName} not in inventory` });
    }
    chestWindow.close();
  }

  async _retrieve(bot, params) {
    const itemName = params[0];
    if (!itemName) return;
    const mcData = require('minecraft-data')(bot.version);
    const chest = bot.findBlock({
      matching: mcData.blocksByName['chest']?.id,
      maxDistance: 32,
    });
    if (!chest) {
      this.addEvent({ type: 'action', summary: 'RETRIEVE failed: no chest nearby' });
      return;
    }
    await bot.pathfinder.goto(new GoalNear(chest.position.x, chest.position.y, chest.position.z, 2));
    const chestWindow = await bot.openContainer(chest);
    const item = chestWindow.containerItems().find((i) => i.name === itemName);
    if (item) {
      await chestWindow.withdraw(item.type, null, item.count);
      this.addEvent({ type: 'action', summary: `Retrieved ${item.count}x ${itemName}` });
    } else {
      this.addEvent({ type: 'action', summary: `RETRIEVE failed: ${itemName} not in chest` });
    }
    chestWindow.close();
  }

  async _place(bot, params) {
    const [blockType, x, y, z] = params;
    if (!blockType || isNaN(Number(x))) {
      this.addEvent({ type: 'action', summary: 'PLACE failed: need blockType,x,y,z' });
      return;
    }
    const item = bot.inventory.items().find((i) => i.name === blockType);
    if (!item) {
      this.addEvent({ type: 'action', summary: `PLACE failed: no ${blockType} in inventory` });
      return;
    }
    await bot.pathfinder.goto(new GoalNear(Number(x), Number(y), Number(z), 2));
    const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    if (refBlock) {
      await bot.equip(item, 'hand');
      await bot.placeBlock(refBlock, { x: 0, y: 1, z: 0 });
      this.addEvent({ type: 'action', summary: `Placed ${blockType}` });
    }
  }

  // ─── Speech ─────────────────────────────────────────────────

  /**
   * Send a chat message, optionally directed at a target.
   *
   * @param {string} message
   * @param {string} [targetName] — prefix message with target's name
   */
  speak(message, targetName) {
    if (!this.mineflayerBot || !this._alive) return;
    const text = targetName ? `${targetName}, ${message}` : message;
    this.mineflayerBot.chat(text);
    this.addEvent({ type: 'chat', summary: `Said: "${text}"` });
  }

  // ─── Event log ──────────────────────────────────────────────

  /**
   * Add an event to the ring buffer.
   * @param {{type: string, summary: string}} event
   */
  addEvent(event) {
    this.eventLog.push({ ...event, timestamp: Date.now() });
    if (this.eventLog.length > this.maxEvents) this.eventLog.shift();
  }

  /**
   * Get the most recent N events, newest first.
   * @param {number} [count=20]
   * @returns {object[]}
   */
  recentEvents(count = 20) {
    return this.eventLog.slice(-count).reverse();
  }

  // ─── Helpers ────────────────────────────────────────────────

  _findEntityByName(bot, name) {
    const lower = name.toLowerCase();
    for (const entity of Object.values(bot.entities)) {
      if (entity === bot.entity) continue;
      const ename = (entity.username || entity.displayName || entity.name || '').toLowerCase();
      if (ename === lower) return entity;
    }
    return null;
  }
}

module.exports = Bot;
