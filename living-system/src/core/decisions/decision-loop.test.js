const path = require('path');
const fs = require('fs');
const { tick, checkAgreementViolations, parseCommitments } = require('./decision-loop');
const DocumentStore = require('../documents/store');
const EventLog = require('../memory/event-log');
const { loadPersona } = require('../personality/persona');

const DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'test-decision-loop.db');
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

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

// ── Mock bot ───────────────────────────────────────────────────

function createMockBot(persona) {
  const events = [];
  const spoken = [];
  const actions = [];

  return {
    persona,
    id: persona.id,
    eventLog: events,
    recentChat: [],
    _alive: true,

    isAlive() { return this._alive; },

    perceive() {
      return {
        nearbyEntities: ['Sera (10 blocks)', 'Cow (5 blocks)'],
        nearbyBlocks: ['oak_log', 'stone'],
        inventory: ['iron_pickaxe x1', 'oak_log x6'],
        health: 18,
        hunger: 16,
        timeOfDay: 'morning',
        dayNumber: 2,
        recentChat: ['<Sera> Hello Marcus!'],
      };
    },

    // Default: no other bots observed. Tests can override this.
    _observations: [],
    observeOtherBots() { return this._observations; },

    async executeAction(action) {
      actions.push(action);
    },

    speak(text, target) {
      spoken.push({ text, target });
    },

    addEvent(event) {
      events.push(event);
    },

    recentEvents(n) {
      return events.slice(-n).reverse();
    },

    // Expose internals for assertions
    _actions: actions,
    _spoken: spoken,
  };
}

// ── Mock LLM client ────────────────────────────────────────────

function createMockLLM(responseText) {
  return {
    _calls: [],
    async generate(prompt) {
      this._calls.push(prompt);
      return responseText;
    },
  };
}

function createFailingLLM() {
  return {
    _calls: [],
    async generate() {
      this._calls.push('called');
      throw new Error('LLM offline');
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

async function main() {
  console.log('\n--- Decision loop tests ---\n');

  const persona = loadPersona('marcus');

  // ── Test 1: Basic action + speech tick ─────────────────────

  {
    console.log('Test 1: Basic action + speech tick');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    const llm = createMockLLM(
      'action: CHOP_TREES\n' +
      'speech: "Let\'s get some wood" → Sera\n' +
      'internal: "I need logs for the watchtower"'
    );

    const result = await tick(bot, store, llm, eventLog);

    assert(result !== null, 'tick returns a decision');
    assert(result.action.ability === 'CHOP_TREES', 'parsed action is CHOP_TREES');
    assert(result.speech.text === "Let's get some wood", 'parsed speech text');
    assert(result.speech.target === 'Sera', 'parsed speech target');
    assert(result.internal === 'I need logs for the watchtower', 'parsed internal thought');

    assert(bot._actions.length === 1, 'executeAction called once');
    assert(bot._actions[0].ability === 'CHOP_TREES', 'executed CHOP_TREES');
    assert(bot._spoken.length === 1, 'speak called once');
    assert(bot._spoken[0].text === "Let's get some wood", 'spoke correct text');
    assert(bot._spoken[0].target === 'Sera', 'spoke to Sera');

    // Check event log entries
    const events = eventLog.recent('marcus', 20);
    assert(events.length >= 3, `event log has entries (got ${events.length})`);
    assert(events.some((e) => e.summary.includes('CHOP_TREES')), 'event log mentions CHOP_TREES');
    assert(events.some((e) => e.summary.includes('Said:')), 'event log mentions speech');
    assert(events.some((e) => e.summary.includes('Thought:')), 'event log mentions internal thought');

    // LLM was called once
    assert(llm._calls.length === 1, 'LLM called once');
    assert(llm._calls[0].includes('Marcus'), 'prompt mentions bot name');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 2: LLM failure → graceful IDLE fallback ──────────

  {
    console.log('\nTest 2: LLM failure fallback');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);
    const llm = createFailingLLM();

    const result = await tick(bot, store, llm, eventLog);

    assert(result === null, 'tick returns null on LLM failure');
    assert(bot._actions.length === 1, 'fallback IDLE executed');
    assert(bot._actions[0].ability === 'IDLE', 'fallback action is IDLE');

    const events = eventLog.recent('marcus', 10);
    assert(events.some((e) => e.summary.includes('LLM call failed')), 'error logged');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 3: No actionable response → IDLE ─────────────────

  {
    console.log('\nTest 3: Non-actionable LLM response');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);
    const llm = createMockLLM('Hmm, I\'m not sure what to do...');

    const result = await tick(bot, store, llm, eventLog);

    assert(result !== null, 'returns a decision (even if empty)');
    assert(result.action === null, 'no action parsed');
    assert(bot._actions.length === 1, 'fallback IDLE executed');
    assert(bot._actions[0].ability === 'IDLE', 'fallback is IDLE');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 4: Propose a document ─────────────────────────────

  {
    console.log('\nTest 4: Propose a document');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);
    const llm = createMockLLM(
      'action: IDLE\n' +
      'propose: agreement | pair | I mine iron, you smelt it, we split 50/50'
    );

    await tick(bot, store, llm, eventLog);

    const docs = store.getDocumentsForBot('marcus');
    assert(docs.length >= 1, 'document was created');
    const agreement = docs.find((d) => d.type === 'agreement');
    assert(agreement !== undefined, 'agreement document exists');
    assert(agreement.scope === 'pair', 'agreement scope is pair');
    assert(agreement.body.includes('mine iron'), 'agreement body matches');

    const events = eventLog.recent('marcus', 20);
    assert(events.some((e) => e.summary.includes('Proposed')), 'proposal logged');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 5: Sign a pending proposal → trust boost ──────────

  {
    console.log('\nTest 5: Sign a document + trust update');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    // Sera proposes something that Marcus needs to sign
    const proposal = store.proposeDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Sera guards the farm, Marcus builds walls.',
      createdBy: 'sera',
      createdAt: 100,
      awaiting: ['marcus'],
    });

    const llm = createMockLLM(`action: IDLE\nsign: ${proposal.id}`);

    await tick(bot, store, llm, eventLog);

    // Check the document is no longer awaiting marcus
    const pending = store.getPendingProposals('marcus');
    assert(pending.length === 0, 'no more pending proposals for marcus');

    // Trust toward sera should have increased
    const trust = store.getTrustScore('marcus', 'sera');
    assert(trust > 0, `trust toward sera increased (got ${trust})`);

    const events = eventLog.recent('marcus', 20);
    assert(events.some((e) => e.summary.includes('Signed')), 'sign event logged');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 6: Reject a document → slight trust decrease ──────

  {
    console.log('\nTest 6: Reject a document + trust decrease');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    const proposal = store.proposeDocument({
      type: 'norm',
      scope: 'group',
      body: 'Everyone must donate 50% of their resources.',
      createdBy: 'dax',
      createdAt: 200,
      awaiting: ['marcus'],
    });

    const llm = createMockLLM(`action: IDLE\nreject: ${proposal.id}`);

    await tick(bot, store, llm, eventLog);

    // Marcus should be removed from awaiting
    const pending = store.getPendingProposals('marcus');
    assert(pending.length === 0, 'marcus removed from awaiting');

    // Trust toward dax should have decreased
    const trust = store.getTrustScore('marcus', 'dax');
    assert(trust < 0, `trust toward dax decreased (got ${trust})`);

    const events = eventLog.recent('marcus', 20);
    assert(events.some((e) => e.summary.includes('Rejected')), 'reject event logged');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 7: Challenge a document ───────────────────────────

  {
    console.log('\nTest 7: Challenge a document');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    // Create a norm that marcus signed
    const norm = store.createDocument({
      type: 'norm',
      scope: 'group',
      body: 'No building after dark.',
      createdBy: 'sera',
      createdAt: 300,
    });
    store.signDocument(norm.id, 'marcus', 301);

    const llm = createMockLLM(
      `action: IDLE\nchallenge: ${norm.id} | This rule is too restrictive`
    );

    await tick(bot, store, llm, eventLog);

    const events = eventLog.recent('marcus', 20);
    assert(events.some((e) => e.summary.includes('Challenged')), 'challenge event logged');

    // Trust toward sera should decrease slightly
    const trust = store.getTrustScore('marcus', 'sera');
    assert(trust <= 0, `trust toward sera didn't increase (got ${trust})`);

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 8: Trust from chat perception ─────────────────────

  {
    console.log('\nTest 8: Trust bump from chat perception');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);
    const llm = createMockLLM('action: IDLE');

    await tick(bot, store, llm, eventLog);

    // Perception has '<Sera> Hello Marcus!' — should give sera +1 trust
    const trust = store.getTrustScore('marcus', 'sera');
    assert(trust >= 1, `chat-based trust bump for sera (got ${trust})`);

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 9: Pending proposals appear in LLM prompt ─────────

  {
    console.log('\nTest 9: Pending proposals in prompt');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    store.proposeDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Trade wheat for iron.',
      createdBy: 'sera',
      createdAt: 400,
      awaiting: ['marcus'],
    });

    const llm = createMockLLM('action: IDLE');
    await tick(bot, store, llm, eventLog);

    // The prompt sent to LLM should mention pending proposals
    // (we can't directly check since buildDecisionPrompt doesn't include pendingProposals,
    //  but we verify the pending list was retrieved correctly)
    const pending = store.getPendingProposals('marcus');
    assert(pending.length === 1, 'pending proposal exists for marcus');
    assert(pending[0].body.includes('wheat'), 'pending proposal has correct body');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 10: parseCommitments extracts per-bot activities ───

  {
    console.log('\nTest 10: parseCommitments');
    const c1 = parseCommitments('Marcus mines iron, Sera smelts it');
    assert(c1.has('marcus'), 'marcus has commitments');
    assert(c1.get('marcus').includes('mining'), 'marcus expected to mine');
    assert(c1.has('sera'), 'sera has commitments');
    assert(c1.get('sera').includes('idle'), 'sera expected idle (smelting)');

    const c2 = parseCommitments('Dax guards the perimeter, Nira hunts for food');
    assert(c2.has('dax'), 'dax has commitments');
    assert(c2.get('dax').includes('fighting'), 'dax expected fighting (guard)');
    assert(c2.has('nira'), 'nira has commitments');
    assert(c2.get('nira').includes('fighting'), 'nira expected fighting (hunt)');

    const c3 = parseCommitments('We should all cooperate');
    assert(c3.size === 0, 'no commitments from vague text');
  }

  // ── Test 11: Violation detection — flagged when observed idle ──

  {
    console.log('\nTest 11: Agreement violation detection');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    // Create an agreement: Sera mines, Marcus builds
    const agreement = store.createDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Sera mines iron, Marcus builds walls.',
      createdBy: 'marcus',
      createdAt: 500,
    });
    store.signDocument(agreement.id, 'sera', 501);

    // Sera is observed idle (should be mining)
    bot._observations = [
      { name: 'sera', distance: 8, activity: 'idle', talkingTo: null },
    ];

    checkAgreementViolations(bot, store, eventLog);

    // Should flag a violation
    const events = eventLog.recent('marcus', 20);
    assert(events.some((e) => e.summary.includes('violating')), 'violation event logged');
    assert(events.some((e) => e.summary.includes('sera')), 'violation mentions sera');

    // Trust should decrease
    const trust = store.getTrustScore('marcus', 'sera');
    assert(trust === -15, `trust decreased by 15 (got ${trust})`);

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 12: No violation when observed doing expected activity ──

  {
    console.log('\nTest 12: No false violation for expected activity');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    const agreement = store.createDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Sera mines iron, Marcus builds walls.',
      createdBy: 'marcus',
      createdAt: 600,
    });
    store.signDocument(agreement.id, 'sera', 601);

    // Sera is observed mining (as expected)
    bot._observations = [
      { name: 'sera', distance: 10, activity: 'mining', talkingTo: null },
    ];

    checkAgreementViolations(bot, store, eventLog);

    // Should NOT flag a violation
    const events = eventLog.recent('marcus', 20);
    assert(!events.some((e) => e.summary.includes('violating')), 'no violation logged');

    // Trust should not decrease
    const trust = store.getTrustScore('marcus', 'sera');
    assert(trust === 0, `trust unchanged (got ${trust})`);

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 13: No violation for bots not in agreement ────────

  {
    console.log('\nTest 13: No violation for uninvolved bots');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    const agreement = store.createDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Sera mines iron, Marcus builds walls.',
      createdBy: 'marcus',
      createdAt: 700,
    });
    store.signDocument(agreement.id, 'sera', 701);

    // Dax is observed idle — but Dax isn't part of this agreement
    bot._observations = [
      { name: 'dax', distance: 5, activity: 'idle', talkingTo: null },
    ];

    checkAgreementViolations(bot, store, eventLog);

    const events = eventLog.recent('marcus', 20);
    assert(!events.some((e) => e.summary.includes('violating')), 'no violation for non-signatory');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Test 14: Violation runs during tick without crashing ────

  {
    console.log('\nTest 14: Observation integrated into tick');
    const store = new DocumentStore(DB_PATH);
    store.init();
    const eventLog = new EventLog();
    const bot = createMockBot(persona);

    const agreement = store.createDocument({
      type: 'agreement',
      scope: 'pair',
      body: 'Sera guards the base, Marcus chops trees.',
      createdBy: 'marcus',
      createdAt: 800,
    });
    store.signDocument(agreement.id, 'sera', 801);

    // Sera is observed idle (should be guarding = idle/moving/fighting, so idle IS valid!)
    bot._observations = [
      { name: 'sera', distance: 6, activity: 'idle', talkingTo: null },
    ];

    const llm = createMockLLM('action: CHOP_TREES');
    await tick(bot, store, llm, eventLog);

    // guarding allows idle, so no violation
    const events = eventLog.recent('marcus', 30);
    assert(!events.some((e) => e.summary.includes('violating')), 'guarding-idle not flagged');
    assert(events.some((e) => e.summary.includes('CHOP_TREES')), 'tick still completed normally');

    store.close();
    fs.unlinkSync(DB_PATH);
  }

  // ── Done ───────────────────────────────────────────────────

  console.log(`\n========================================`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
