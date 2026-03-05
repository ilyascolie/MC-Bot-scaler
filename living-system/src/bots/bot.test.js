const Bot = require('./bot');
const { loadPersona } = require('../core/personality/persona');
const net = require('net');

const HOST = process.env.MC_HOST || 'localhost';
const PORT = parseInt(process.env.MC_PORT || '25565', 10);
const VERSION = process.env.MC_VERSION || undefined;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

/**
 * Probe whether the server is reachable (TCP connect only).
 */
function isServerUp(host, port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port, timeout: 2000 });
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

async function runOfflineTests() {
  console.log('\n--- Offline tests (no server required) ---\n');

  const persona = loadPersona('marcus');

  // 1. Constructor
  const bot = new Bot(persona, { host: HOST, port: PORT, version: VERSION });
  assert(bot.persona.id === 'marcus', 'persona loaded correctly');
  assert(bot.isAlive() === false, 'bot starts not alive');
  assert(bot.eventLog.length === 0, 'event log starts empty');
  assert(bot.recentChat.length === 0, 'chat buffer starts empty');
  assert(bot.mineflayerBot === null, 'mineflayer bot starts null');

  // 2. Event log ring buffer
  for (let i = 0; i < 25; i++) {
    bot.addEvent({ type: 'test', summary: `Event ${i}` });
  }
  assert(bot.eventLog.length === 20, `ring buffer capped at 20 (got ${bot.eventLog.length})`);
  assert(bot.eventLog[0].summary === 'Event 5', 'oldest event is Event 5 (first 5 evicted)');
  assert(bot.eventLog[19].summary === 'Event 24', 'newest event is Event 24');

  // 3. recentEvents returns newest first
  const recent = bot.recentEvents(3);
  assert(recent.length === 3, 'recentEvents(3) returns 3');
  assert(recent[0].summary === 'Event 24', 'first recent is newest');
  assert(recent[2].summary === 'Event 22', 'third recent is third-newest');

  // 4. perceive() without connection returns empty perception
  const empty = bot.perceive();
  assert(empty.health === 0, 'empty perception health is 0');
  assert(Array.isArray(empty.nearbyEntities), 'empty perception has nearbyEntities array');
  assert(empty.inventory.length === 0, 'empty perception has empty inventory');

  // 5. executeAction without connection doesn't crash
  await bot.executeAction({ ability: 'IDLE', params: [] });
  assert(true, 'executeAction(IDLE) with no connection doesn\'t throw');

  await bot.executeAction({ ability: 'WANDER', params: [] });
  assert(true, 'executeAction(WANDER) with no connection doesn\'t throw');

  await bot.executeAction(null);
  assert(true, 'executeAction(null) doesn\'t throw');

  // 6. speak without connection doesn't crash
  bot.speak('Hello world');
  assert(true, 'speak() with no connection doesn\'t throw');

  // 7. disconnect without connection doesn't crash
  bot.disconnect();
  assert(true, 'disconnect() with no connection doesn\'t throw');
}

async function runLiveTests() {
  console.log('\n--- Live tests (Minecraft server at ' + HOST + ':' + PORT + ') ---\n');

  const persona = loadPersona('marcus');
  const bot = new Bot(persona, { host: HOST, port: PORT, version: VERSION });

  // Connect
  console.log('  Connecting...');
  try {
    await bot.connect();
  } catch (err) {
    console.error(`  Connection failed: ${err.message}`);
    console.error('  Skipping live tests.');
    return;
  }
  assert(bot.isAlive(), 'bot is alive after connect');
  assert(bot.mineflayerBot !== null, 'mineflayer bot instance exists');

  // Perceive
  console.log('  Perceiving...');
  const perception = bot.perceive();
  console.log(`    Health: ${perception.health}/20`);
  console.log(`    Food:   ${perception.food}/20`);
  console.log(`    Time:   ${perception.timeOfDay}`);
  console.log(`    Day:    ${perception.dayCount}`);
  console.log(`    Entities: ${perception.nearbyEntities.length}`);
  console.log(`    Blocks:   ${perception.nearbyBlocks.length}`);
  console.log(`    Inventory: ${perception.inventory.length} stacks`);

  assert(typeof perception.health === 'number', 'perception.health is number');
  assert(typeof perception.food === 'number', 'perception.food is number');
  assert(Array.isArray(perception.nearbyEntities), 'nearbyEntities is array');
  assert(Array.isArray(perception.inventory), 'inventory is array');
  assert(perception.timeOfDay != null, 'timeOfDay is present');

  // Record starting position
  const startPos = bot.mineflayerBot.entity.position.clone();
  console.log(`    Position: (${Math.round(startPos.x)}, ${Math.round(startPos.y)}, ${Math.round(startPos.z)})`);

  // WANDER — bot should move
  console.log('  Executing WANDER...');
  await bot.executeAction({ ability: 'WANDER', params: [] });

  // Small delay to let pathfinder settle
  await new Promise((r) => setTimeout(r, 1000));

  const endPos = bot.mineflayerBot.entity.position;
  const dist = startPos.distanceTo(endPos);
  console.log(`    Moved: ${dist.toFixed(1)} blocks`);
  assert(dist > 0.5, `bot moved after WANDER (${dist.toFixed(1)} blocks)`);

  // IDLE should not crash
  console.log('  Executing IDLE...');
  await bot.executeAction({ ability: 'IDLE', params: [] });
  assert(true, 'IDLE completed without error');

  // Event log should have entries
  const events = bot.recentEvents(5);
  console.log(`    Recent events: ${events.length}`);
  events.forEach((e) => console.log(`      [${e.type}] ${e.summary}`));
  assert(events.length >= 2, 'event log has entries from actions');

  // Speak
  console.log('  Speaking...');
  bot.speak('Hello world!');
  assert(bot.eventLog.some((e) => e.summary.includes('Said:')), 'speak logged to events');

  // Disconnect
  console.log('  Disconnecting...');
  bot.disconnect();
  assert(!bot.isAlive(), 'bot is not alive after disconnect');

  console.log();
}

async function main() {
  await runOfflineTests();

  const up = await isServerUp(HOST, PORT);
  if (up) {
    await runLiveTests();
  } else {
    console.log(`\n--- Live tests SKIPPED (no server at ${HOST}:${PORT}) ---`);
    console.log('  Start the Minecraft server with: docker compose up -d\n');
  }

  console.log(`========================================`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
