const fs = require('fs');
const path = require('path');
const ConversationLogger = require('./conversation-logger');
const Dashboard = require('./dashboard');
const DocumentStore = require('../core/documents/store');

const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'test-logs');
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-logging.db');

// Cleanup
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
if (fs.existsSync(LOG_DIR)) fs.rmSync(LOG_DIR, { recursive: true });

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

function main() {
  console.log('\n--- Logging tests ---\n');

  // ── Test 1: ConversationLogger writes narrative log ─────────

  {
    console.log('Test 1: ConversationLogger narrative output');

    const store = new DocumentStore(DB_PATH);
    store.init();

    // Create an agreement for context
    const agreement = store.createDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Marcus mines iron, Sera smelts it.',
      createdBy: 'marcus',
      createdAt: 100,
    });
    store.signDocument(agreement.id, 'sera', 101);
    store.updateTrust('marcus', 'sera', 35, 200);
    store.updateTrust('marcus', 'dax', -12, 200);

    const logger = new ConversationLogger({ logDir: LOG_DIR });
    logger.init();

    const perception = {
      nearbyEntities: [
        { name: 'Sera', type: 'player', distance: 5 },
        { name: 'Cow', type: 'mob', distance: 12 },
      ],
      nearbyBlocks: ['oak_log', 'iron_ore'],
      inventory: [{ name: 'iron_pickaxe', count: 1 }],
      health: 18,
      food: 16,
      timeOfDay: 'morning',
      dayCount: 3,
      recentChat: [],
    };

    const decision = {
      action: { ability: 'MINE', params: ['iron_ore'] },
      speech: { text: 'Sera, I found more iron to the north', target: 'Sera' },
      internal: "She's been reliable so far. I'll keep this partnership going.",
      propose: null,
      challenge: null,
      sign: null,
      reject: null,
    };

    logger.logTick({
      botName: 'Marcus',
      perception,
      decision,
      store,
      botId: 'marcus',
      decisionTimeMs: 2134,
    });

    // Log a second tick with a proposal
    logger.logTick({
      botName: 'Sera',
      perception: { ...perception, dayCount: 3 },
      decision: {
        action: { ability: 'IDLE', params: [] },
        speech: null,
        internal: 'I should propose a norm about sharing.',
        propose: { type: 'norm', scope: 'group', body: 'Share all iron equally' },
        challenge: null,
        sign: null,
        reject: null,
      },
      store,
      botId: 'sera',
      decisionTimeMs: 1850,
    });

    // Log a notable event
    logger.logEvent('Bron died (zombie)', 3);

    logger.close();

    // Read the file
    const logFile = path.join(LOG_DIR, 'narrative', 'day-003.log');
    assert(fs.existsSync(logFile), 'day-003.log was created');

    const content = fs.readFileSync(logFile, 'utf-8');
    assert(content.includes('MARCUS'), 'log contains MARCUS header');
    assert(content.includes('MINE(iron_ore)'), 'log contains action');
    assert(content.includes('Sera, I found more iron'), 'log contains speech');
    assert(content.includes('reliable'), 'log contains internal thought');
    assert(content.includes('Sera +35'), 'log contains trust scores');
    assert(content.includes('Dax -12'), 'log contains negative trust');
    assert(content.includes('sees:'), 'log contains perception');
    assert(content.includes('2134ms'), 'log contains decision time');
    assert(content.includes('SERA'), 'log contains Sera header');
    assert(content.includes('propose: norm/group'), 'log contains proposal');
    assert(content.includes('Bron died'), 'log contains event');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 2: Dashboard renders without crashing ──────────────

  {
    console.log('\nTest 2: Dashboard rendering');

    const store = new DocumentStore(DB_PATH);
    store.init();

    store.createDocument({
      type: 'plan',
      scope: 'self',
      body: 'Gather wood',
      createdBy: 'marcus',
      createdAt: 100,
    });
    store.createDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Mining deal',
      createdBy: 'marcus',
      createdAt: 200,
    });

    // Mock manager
    const mockManager = {
      bots: new Map(),
      getStatus() {
        return {
          alive: 2,
          total: 3,
          bots: [
            { name: 'Marcus', id: 'marcus', alive: true, kegan: 4 },
            { name: 'Sera', id: 'sera', alive: true, kegan: 3 },
            { name: 'Dax', id: 'dax', alive: false, kegan: 2 },
          ],
        };
      },
    };

    const dashboard = new Dashboard({
      manager: mockManager,
      store,
      intervalMs: 60000,
    });

    // Record some LLM calls
    dashboard.recordLlmCall(2100);
    dashboard.recordLlmCall(1800);
    dashboard.recordLlmCall(2400);

    // Add events
    dashboard.addEvent('Marcus proposed norm to group');
    dashboard.addEvent("Dax rejected Sera's agreement");
    dashboard.addEvent('Bron died (zombie)');

    assert(dashboard.llmCalls === 3, `LLM calls tracked (got ${dashboard.llmCalls})`);
    assert(Math.abs(dashboard.totalLlmTimeMs - 6300) < 1, 'LLM total time tracked');
    assert(dashboard._recentEvents.length === 3, 'recent events tracked');

    // Render should not crash
    let renderOk = true;
    try {
      // Capture output to verify it renders
      const origLog = console.log;
      let output = '';
      console.log = (...args) => { output += args.join(' ') + '\n'; };
      dashboard.render();
      console.log = origLog;

      assert(output.includes('LIVING SYSTEM'), 'dashboard contains title');
      assert(output.includes('2/3'), 'dashboard shows bot count');
      assert(output.includes('LLM calls'), 'dashboard shows LLM stats');
      assert(output.includes('Marcus'), 'dashboard lists Marcus');
      assert(output.includes('DEAD'), 'dashboard shows dead bot');
      assert(output.includes('Bron died'), 'dashboard shows recent events');
      assert(output.includes('\u250C'), 'dashboard has box border (top-left)');
      assert(output.includes('\u2514'), 'dashboard has box border (bottom-left)');
    } catch (err) {
      renderOk = false;
    }
    assert(renderOk, 'dashboard.render() did not crash');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 3: Dashboard event ring buffer ─────────────────────

  {
    console.log('\nTest 3: Dashboard event ring buffer');

    const dashboard = new Dashboard({
      manager: { bots: new Map(), getStatus() { return { alive: 0, total: 0, bots: [] }; } },
      store: { getDocumentsForBot() { return []; }, getTrustMap() { return {}; } },
    });

    // Add more than maxRecent events
    for (let i = 0; i < 12; i++) {
      dashboard.addEvent(`Event ${i}`);
    }

    assert(dashboard._recentEvents.length === 8, `ring buffer capped at 8 (got ${dashboard._recentEvents.length})`);
    assert(dashboard._recentEvents[0].message === 'Event 4', 'oldest retained is Event 4');
    assert(dashboard._recentEvents[7].message === 'Event 11', 'newest is Event 11');
  }

  // ── Test 4: ConversationLogger day file switching ───────────

  {
    console.log('\nTest 4: Day file switching');

    const store = new DocumentStore(DB_PATH);
    store.init();

    const logger = new ConversationLogger({ logDir: LOG_DIR });
    logger.init();

    // Log to day 1
    logger.logTick({
      botName: 'Marcus',
      perception: { dayCount: 1, health: 20, food: 20 },
      decision: { action: { ability: 'IDLE', params: [] } },
      store,
      botId: 'marcus',
    });

    // Log to day 5
    logger.logTick({
      botName: 'Sera',
      perception: { dayCount: 5, health: 20, food: 20 },
      decision: { action: { ability: 'WANDER', params: [] } },
      store,
      botId: 'sera',
    });

    logger.close();

    const day1 = path.join(LOG_DIR, 'narrative', 'day-001.log');
    const day5 = path.join(LOG_DIR, 'narrative', 'day-005.log');

    assert(fs.existsSync(day1), 'day-001.log exists');
    assert(fs.existsSync(day5), 'day-005.log exists');
    assert(fs.readFileSync(day1, 'utf-8').includes('MARCUS'), 'day 1 has Marcus');
    assert(fs.readFileSync(day5, 'utf-8').includes('SERA'), 'day 5 has Sera');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Cleanup ────────────────────────────────────────────────

  if (fs.existsSync(LOG_DIR)) fs.rmSync(LOG_DIR, { recursive: true });

  // ── Done ───────────────────────────────────────────────────

  console.log(`\n========================================`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
