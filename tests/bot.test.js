'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Bot = require('../src/bots/bot');
const EventLog = require('../src/core/memory/event-log');
const { getMeaningContext, MEANING_CONTEXT } = require('../src/adapters/minecraft-vanilla/meaning');
const { buildPerception } = require('../src/adapters/minecraft-vanilla/perception');
const AdapterInterface = require('../src/adapters/adapter-interface');
const MinecraftVanillaAdapter = require('../src/adapters/minecraft-vanilla/index');

const mockPersona = {
  id: 'marcus', name: 'Marcus', kegan_level: 4,
  honesty: 0.9, agreeableness: 0.6, risk_tolerance: 0.3,
  social_drive: 0.7, self_awareness: 0.8,
  backstory: 'A principled leader.'
};

const mockConfig = { host: 'localhost', port: 25565, version: '1.20.4' };

// === Bot Class Tests ===

test('constructs bot with persona', () => {
  const bot = new Bot(mockPersona, mockConfig);
  assert.strictEqual(bot.persona.id, 'marcus');
  assert.strictEqual(bot.persona.name, 'Marcus');
  assert.strictEqual(bot.isAlive(), false);
  assert.strictEqual(bot.isConnected(), false);
});

test('has event log', () => {
  const bot = new Bot(mockPersona, mockConfig);
  assert.ok(bot.eventLog instanceof EventLog);
});

test('empty perception when not connected', () => {
  const bot = new Bot(mockPersona, mockConfig);
  const p = bot.perceive();
  assert.deepStrictEqual(p.nearbyEntities, []);
  assert.deepStrictEqual(p.nearbyBlocks, []);
  assert.deepStrictEqual(p.inventory, []);
  assert.strictEqual(p.health, 0);
  assert.strictEqual(p.food, 0);
  assert.strictEqual(p.timeOfDay, 'unknown');
  assert.strictEqual(p.dayCount, 0);
  assert.deepStrictEqual(p.recentChat, []);
});

test('chat buffer starts empty', () => {
  const bot = new Bot(mockPersona, mockConfig);
  assert.strictEqual(bot.chatBuffer.length, 0);
});

test('observeOtherBots returns empty when not connected', () => {
  const bot = new Bot(mockPersona, mockConfig);
  assert.deepStrictEqual(bot.observeOtherBots(), []);
});

test('executeAction handles null gracefully', async () => {
  const bot = new Bot(mockPersona, mockConfig);
  await bot.executeAction(null); // should not throw
});

test('executeAction handles undefined gracefully', async () => {
  const bot = new Bot(mockPersona, mockConfig);
  await bot.executeAction(undefined); // should not throw
});

test('executeAction does nothing when bot is not alive', async () => {
  const bot = new Bot(mockPersona, mockConfig);
  await bot.executeAction({ ability: 'IDLE', params: [] }); // should not throw
});

test('disconnect when not connected', async () => {
  const bot = new Bot(mockPersona, mockConfig);
  await bot.disconnect(); // should not throw
  assert.strictEqual(bot.isAlive(), false);
  assert.strictEqual(bot.isConnected(), false);
  assert.strictEqual(bot.bot, null);
});

test('speak does nothing when not connected', () => {
  const bot = new Bot(mockPersona, mockConfig);
  bot.speak('hello'); // should not throw
  bot.speak('hello', 'someone'); // should not throw
});

test('bot extends EventEmitter', () => {
  const bot = new Bot(mockPersona, mockConfig);
  assert.strictEqual(typeof bot.on, 'function');
  assert.strictEqual(typeof bot.emit, 'function');
  assert.strictEqual(typeof bot.removeListener, 'function');
});

test('bot stores serverConfig', () => {
  const bot = new Bot(mockPersona, mockConfig);
  assert.strictEqual(bot.serverConfig.host, 'localhost');
  assert.strictEqual(bot.serverConfig.port, 25565);
  assert.strictEqual(bot.serverConfig.version, '1.20.4');
});

test('bot chatBufferSize defaults to 5', () => {
  const bot = new Bot(mockPersona, mockConfig);
  assert.strictEqual(bot.chatBufferSize, 5);
});

// === EventLog Tests ===

test('EventLog push and recent', () => {
  const log = new EventLog(3);
  log.push({ type: 'a', data: '1' });
  log.push({ type: 'b', data: '2' });
  log.push({ type: 'c', data: '3' });
  assert.strictEqual(log.length, 3);
  const all = log.recent();
  assert.strictEqual(all.length, 3);
  assert.strictEqual(all[0].type, 'a');
});

test('EventLog ring buffer evicts oldest', () => {
  const log = new EventLog(2);
  log.push({ type: 'a', data: '1' });
  log.push({ type: 'b', data: '2' });
  log.push({ type: 'c', data: '3' });
  assert.strictEqual(log.length, 2);
  const all = log.recent();
  assert.strictEqual(all[0].type, 'b');
  assert.strictEqual(all[1].type, 'c');
});

test('EventLog recent(n) returns last n entries', () => {
  const log = new EventLog(10);
  log.push({ type: 'a', data: '1' });
  log.push({ type: 'b', data: '2' });
  log.push({ type: 'c', data: '3' });
  const last2 = log.recent(2);
  assert.strictEqual(last2.length, 2);
  assert.strictEqual(last2[0].type, 'b');
  assert.strictEqual(last2[1].type, 'c');
});

test('EventLog clear empties the buffer', () => {
  const log = new EventLog(10);
  log.push({ type: 'a', data: '1' });
  log.push({ type: 'b', data: '2' });
  log.clear();
  assert.strictEqual(log.length, 0);
  assert.deepStrictEqual(log.recent(), []);
});

test('EventLog default maxSize is 20', () => {
  const log = new EventLog();
  for (let i = 0; i < 25; i++) {
    log.push({ type: 'x', data: String(i) });
  }
  assert.strictEqual(log.length, 20);
});

// === Meaning Context Tests ===

test('getMeaningContext returns morning context', () => {
  const result = getMeaningContext({ timeOfDay: 'morning', health: 20, food: 20 });
  assert.ok(result.includes('sun is rising'));
});

test('getMeaningContext returns critical health context', () => {
  const result = getMeaningContext({ timeOfDay: 'afternoon', health: 3, food: 20 });
  assert.ok(result.includes('badly wounded'));
});

test('getMeaningContext returns starving context', () => {
  const result = getMeaningContext({ timeOfDay: 'afternoon', health: 20, food: 2 });
  assert.ok(result.includes('starving'));
});

test('getMeaningContext returns night + low health + hungry', () => {
  const result = getMeaningContext({ timeOfDay: 'night', health: 8, food: 5 });
  assert.ok(result.includes('Darkness'));
  assert.ok(result.includes('hurt'));
  assert.ok(result.includes('hungry'));
});

test('getMeaningContext returns empty for healthy well-fed', () => {
  const result = getMeaningContext({ timeOfDay: 'afternoon', health: 20, food: 20 });
  assert.ok(result.includes('Midday'));
  assert.ok(!result.includes('wounded'));
  assert.ok(!result.includes('starving'));
});

test('MEANING_CONTEXT has all time periods', () => {
  assert.ok(MEANING_CONTEXT.time.morning);
  assert.ok(MEANING_CONTEXT.time.afternoon);
  assert.ok(MEANING_CONTEXT.time.sunset);
  assert.ok(MEANING_CONTEXT.time.night);
});

// === Perception Tests ===

test('buildPerception returns empty for null bot', () => {
  const p = buildPerception(null, []);
  assert.strictEqual(p.health, 0);
  assert.strictEqual(p.timeOfDay, 'unknown');
  assert.deepStrictEqual(p.nearbyEntities, []);
});

// === Adapter Interface Tests ===

test('AdapterInterface methods throw when not implemented', async () => {
  const adapter = new AdapterInterface();
  await assert.rejects(() => adapter.connect(), /not implemented/);
  await assert.rejects(() => adapter.disconnect(), /not implemented/);
  assert.throws(() => adapter.perceive(), /not implemented/);
  await assert.rejects(() => adapter.executeAction(), /not implemented/);
  assert.throws(() => adapter.speak(), /not implemented/);
});

// === MinecraftVanillaAdapter Tests ===

test('MinecraftVanillaAdapter extends AdapterInterface', () => {
  const adapter = new MinecraftVanillaAdapter();
  assert.ok(adapter instanceof AdapterInterface);
});

test('MinecraftVanillaAdapter perceive returns null when no bot', () => {
  const adapter = new MinecraftVanillaAdapter();
  assert.strictEqual(adapter.perceive(), null);
});

test('MinecraftVanillaAdapter disconnect when no bot', async () => {
  const adapter = new MinecraftVanillaAdapter();
  await adapter.disconnect(); // should not throw
});

test('MinecraftVanillaAdapter speak does nothing when no bot', () => {
  const adapter = new MinecraftVanillaAdapter();
  adapter.speak('hello'); // should not throw
});

test('MinecraftVanillaAdapter executeAction does nothing when no bot', async () => {
  const adapter = new MinecraftVanillaAdapter();
  await adapter.executeAction({ ability: 'IDLE', params: [] }); // should not throw
});

test('MinecraftVanillaAdapter has skills and abilities', () => {
  const adapter = new MinecraftVanillaAdapter();
  assert.ok(adapter.skills);
  assert.ok(adapter.abilities);
  assert.strictEqual(typeof adapter.skills.idle, 'function');
  assert.strictEqual(typeof adapter.skills.wander, 'function');
  assert.strictEqual(typeof adapter.skills.goTo, 'function');
  assert.strictEqual(typeof adapter.skills.follow, 'function');
  assert.strictEqual(typeof adapter.skills.flee, 'function');
  assert.strictEqual(typeof adapter.skills.mine, 'function');
  assert.strictEqual(typeof adapter.skills.chopTrees, 'function');
  assert.strictEqual(typeof adapter.skills.eat, 'function');
  assert.strictEqual(typeof adapter.skills.buildShelter, 'function');
  assert.strictEqual(typeof adapter.skills.place, 'function');
  assert.strictEqual(typeof adapter.skills.craft, 'function');
  assert.strictEqual(typeof adapter.skills.store, 'function');
  assert.strictEqual(typeof adapter.skills.retrieve, 'function');
  assert.strictEqual(typeof adapter.skills.attack, 'function');
});

test('MinecraftVanillaAdapter getMeaningContext works', () => {
  const adapter = new MinecraftVanillaAdapter();
  const result = adapter.getMeaningContext({ timeOfDay: 'morning', health: 20, food: 20 });
  assert.ok(result.includes('sun is rising'));
});

test('MinecraftVanillaAdapter has abilities', () => {
  const adapter = new MinecraftVanillaAdapter();
  assert.strictEqual(typeof adapter.abilities.gatherWood, 'function');
  assert.strictEqual(typeof adapter.abilities.hunt, 'function');
  assert.strictEqual(typeof adapter.abilities.buildShelter, 'function');
  assert.strictEqual(typeof adapter.abilities.explore, 'function');
  assert.strictEqual(typeof adapter.abilities.forage, 'function');
});
