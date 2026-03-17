'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { tick, startDecisionLoop, checkAgreementViolations, parseCommitments, COMMITMENT_KEYWORDS } = require('../src/core/decisions/decision-loop');

// ─── Mock Factories ───────────────────────────────────────────────────────────

function createMockBot(overrides = {}) {
  return {
    persona: {
      id: 'marcus', name: 'Marcus', kegan_level: 4,
      honesty: 0.9, agreeableness: 0.6, risk_tolerance: 0.3,
      social_drive: 0.7, self_awareness: 0.8, backstory: 'A leader.',
    },
    isAlive: () => true,
    perceive: () => ({
      nearbyEntities: [{ name: 'Sera', type: 'player', distance: 5 }],
      nearbyBlocks: ['iron_ore'],
      inventory: [{ name: 'wooden_pickaxe', count: 1 }],
      health: 18, food: 16,
      timeOfDay: 'morning', dayCount: 3,
      recentChat: [],
    }),
    executeAction: async () => {},
    speak: () => {},
    observeOtherBots: () => [],
    eventLog: { push: () => {}, recent: () => [] },
    ...overrides,
  };
}

function createMockStore(overrides = {}) {
  return {
    getDocumentsForBot: () => [],
    getDocumentTree: () => '',
    getPendingProposals: () => [],
    createDocument: () => {},
    proposeDocument: () => {},
    signDocument: () => {},
    removeFromAwaiting: () => {},
    challengeDocument: () => {},
    getTrustScore: () => 0,
    updateTrust: () => {},
    getTrustMap: () => ({}),
    getSignatories: () => [],
    ...overrides,
  };
}

function createMockLLM(response = 'action: IDLE') {
  return {
    generate: async () => response,
    generateStrategic: async () => response,
  };
}

// ─── tick() tests ─────────────────────────────────────────────────────────────

test('tick returns parsed decision with action', async () => {
  const decision = await tick(createMockBot(), createMockStore(), createMockLLM('action: MINE(iron_ore)'));
  assert.strictEqual(decision.action.ability, 'MINE');               // 1
  assert.deepStrictEqual(decision.action.params, ['iron_ore']);       // 2
});

test('tick executes action on the bot', async () => {
  let executed = null;
  const bot = createMockBot({ executeAction: async (a) => { executed = a; } });
  await tick(bot, createMockStore(), createMockLLM('action: WANDER'));
  assert.strictEqual(executed.ability, 'WANDER');                    // 3
  assert.deepStrictEqual(executed.params, []);                       // 4
});

test('tick logs action to eventLog', async () => {
  const events = [];
  const bot = createMockBot({ eventLog: { push: (e) => events.push(e), recent: () => [] } });
  await tick(bot, createMockStore(), createMockLLM('action: MINE(stone)'));
  const actionEvent = events.find(e => e.type === 'action');
  assert.ok(actionEvent);                                            // 5
  assert.ok(actionEvent.data.includes('MINE'));                      // 6
});

test('tick handles speech with target', async () => {
  let spoken = null;
  const bot = createMockBot({ speak: (text, target) => { spoken = { text, target }; } });
  await tick(bot, createMockStore(), createMockLLM('action: IDLE\nspeech: "Hello!" -> Sera'));
  assert.strictEqual(spoken.text, 'Hello!');                         // 7
  assert.strictEqual(spoken.target, 'Sera');                         // 8
});

test('tick handles speech without target', async () => {
  let spoken = null;
  const bot = createMockBot({ speak: (text, target) => { spoken = { text, target }; } });
  await tick(bot, createMockStore(), createMockLLM('action: IDLE\nspeech: "Good morning"'));
  assert.strictEqual(spoken.text, 'Good morning');                   // 9
  assert.strictEqual(spoken.target, null);                           // 10
});

test('tick logs speech to eventLog', async () => {
  const events = [];
  const bot = createMockBot({
    speak: () => {},
    eventLog: { push: (e) => events.push(e), recent: () => [] },
  });
  await tick(bot, createMockStore(), createMockLLM('action: IDLE\nspeech: "Hi" -> Sera'));
  const speechEvent = events.find(e => e.type === 'speech');
  assert.ok(speechEvent);                                            // 11
  assert.ok(speechEvent.data.includes('Hi'));                        // 12
});

test('tick handles internal thought', async () => {
  const events = [];
  const bot = createMockBot({ eventLog: { push: (e) => events.push(e), recent: () => [] } });
  await tick(bot, createMockStore(), createMockLLM('action: IDLE\ninternal: I should mine more'));
  const internalEvent = events.find(e => e.type === 'internal');
  assert.ok(internalEvent);                                          // 13
  assert.ok(internalEvent.data.includes('mine more'));               // 14
});

test('tick handles propose', async () => {
  let proposed = null;
  const store = createMockStore({ proposeDocument: (doc) => { proposed = doc; } });
  await tick(createMockBot(), store, createMockLLM('action: IDLE\npropose: agreement | pair | We share iron'));
  assert.strictEqual(proposed.type, 'agreement');                    // 15
  assert.strictEqual(proposed.scope, 'pair');                        // 16
  assert.ok(proposed.body.includes('share iron'));                   // 17
  assert.strictEqual(proposed.created_by, 'marcus');                 // 18
});

test('tick propose sets awaiting to nearby players excluding self', async () => {
  let proposed = null;
  const store = createMockStore({ proposeDocument: (doc) => { proposed = doc; } });
  await tick(createMockBot(), store, createMockLLM('action: IDLE\npropose: agreement | pair | Trade iron'));
  assert.ok(Array.isArray(proposed.awaiting));                       // 19
  assert.ok(proposed.awaiting.includes('sera'));                     // 20
  assert.ok(!proposed.awaiting.includes('marcus'));                  // 21
});

test('tick handles sign with trust update (+5 mutual)', async () => {
  let signed = null;
  const trustUpdates = [];
  const store = createMockStore({
    signDocument: (docId, botId) => { signed = { docId, botId }; },
    getSignatories: () => ['sera'],
    updateTrust: (from, to, delta) => { trustUpdates.push({ from, to, delta }); },
  });
  await tick(createMockBot(), store, createMockLLM('action: IDLE\nsign: doc-123'));
  assert.strictEqual(signed.docId, 'doc-123');                      // 22
  assert.strictEqual(signed.botId, 'marcus');                       // 23
  assert.ok(trustUpdates.some(t => t.from === 'marcus' && t.to === 'sera' && t.delta === 5)); // 24
  assert.ok(trustUpdates.some(t => t.from === 'sera' && t.to === 'marcus' && t.delta === 5)); // 25
});

test('tick handles reject with trust penalty (-2)', async () => {
  const trustUpdates = [];
  let removedAwaiting = null;
  const store = createMockStore({
    getSignatories: () => ['sera'],
    updateTrust: (from, to, delta) => { trustUpdates.push({ from, to, delta }); },
    removeFromAwaiting: (docId, botId) => { removedAwaiting = { docId, botId }; },
  });
  await tick(createMockBot(), store, createMockLLM('action: IDLE\nreject: doc-456'));
  assert.ok(trustUpdates.some(t => t.delta === -2));                 // 26
  assert.strictEqual(removedAwaiting.docId, 'doc-456');              // 27
  assert.strictEqual(removedAwaiting.botId, 'marcus');               // 28
});

test('tick handles challenge with trust penalty (-2)', async () => {
  const trustUpdates = [];
  let challenged = null;
  const store = createMockStore({
    challengeDocument: (docId, who, reason) => { challenged = { docId, who, reason }; },
    getSignatories: () => ['sera'],
    updateTrust: (from, to, delta) => { trustUpdates.push({ from, to, delta }); },
  });
  await tick(createMockBot(), store, createMockLLM('action: IDLE\nchallenge: doc-789 | Unfair terms'));
  assert.strictEqual(challenged.docId, 'doc-789');                   // 29
  assert.strictEqual(challenged.reason, 'Unfair terms');             // 30
  assert.ok(trustUpdates.some(t => t.delta === -2));                 // 31
});

test('tick falls back to IDLE on LLM failure', async () => {
  const events = [];
  const bot = createMockBot({ eventLog: { push: (e) => events.push(e), recent: () => [] } });
  const llm = {
    generate: async () => { throw new Error('LLM down'); },
    generateStrategic: async () => { throw new Error('LLM down'); },
  };
  const decision = await tick(bot, createMockStore(), llm);
  assert.strictEqual(decision.action.ability, 'IDLE');               // 32
  assert.deepStrictEqual(decision.action.params, []);                // 33
  assert.strictEqual(decision.speech, null);                         // 34
  const errorEvent = events.find(e => e.type === 'llm_error');
  assert.ok(errorEvent);                                             // 35
});

test('tick uses strategic model for K4+ bots', async () => {
  let usedStrategic = false;
  const llm = {
    generate: async () => 'action: IDLE',
    generateStrategic: async () => { usedStrategic = true; return 'action: IDLE'; },
  };
  await tick(createMockBot(), createMockStore(), llm);
  assert.ok(usedStrategic);                                          // 36
});

test('tick uses routine model for K2 bots', async () => {
  let usedRoutine = false;
  const llm = {
    generate: async () => { usedRoutine = true; return 'action: IDLE'; },
    generateStrategic: async () => 'action: IDLE',
  };
  const bot = createMockBot({ persona: { ...createMockBot().persona, kegan_level: 2 } });
  await tick(bot, createMockStore(), llm);
  assert.ok(usedRoutine);                                            // 37
});

test('tick uses strategic when pending proposals exist even for low-K bot', async () => {
  let usedStrategic = false;
  const llm = {
    generate: async () => 'action: IDLE',
    generateStrategic: async () => { usedStrategic = true; return 'action: IDLE'; },
  };
  const bot = createMockBot({ persona: { ...createMockBot().persona, kegan_level: 2 } });
  const store = createMockStore({
    getPendingProposals: () => [{ id: 'p1', type: 'agreement', scope: 'pair', body: 'Trade iron' }],
  });
  await tick(bot, store, llm);
  assert.ok(usedStrategic);                                          // 38
});

test('tick handles action execution failure gracefully', async () => {
  const events = [];
  const bot = createMockBot({
    executeAction: async () => { throw new Error('Cannot mine here'); },
    eventLog: { push: (e) => events.push(e), recent: () => [] },
  });
  const decision = await tick(bot, createMockStore(), createMockLLM('action: MINE(diamond_ore)'));
  assert.strictEqual(decision.action.ability, 'MINE');               // 39
  const errorEvent = events.find(e => e.type === 'action_error');
  assert.ok(errorEvent);                                             // 40
  assert.ok(errorEvent.data.includes('Cannot mine here'));           // 41
});

test('tick injects pending proposals into prompt', async () => {
  let capturedPrompt = null;
  const llm = {
    generate: async (p) => { capturedPrompt = p; return 'action: IDLE'; },
    generateStrategic: async (p) => { capturedPrompt = p; return 'action: IDLE'; },
  };
  const store = createMockStore({
    getPendingProposals: () => [{ id: 'p1', type: 'agreement', scope: 'pair', body: 'Share resources' }],
  });
  await tick(createMockBot(), store, llm);
  assert.ok(capturedPrompt.includes('PENDING PROPOSALS'));           // 42
  assert.ok(capturedPrompt.includes('Share resources'));             // 43
});

test('tick calls conversationLogger.logTick when provided', async () => {
  let logged = null;
  const logger = { logTick: (data) => { logged = data; } };
  await tick(createMockBot(), createMockStore(), createMockLLM('action: IDLE'), { conversationLogger: logger });
  assert.ok(logged);                                                 // 44
  assert.strictEqual(logged.botName, 'Marcus');                      // 45
  assert.ok(logged.elapsed >= 0);                                    // 46
});

test('tick passive trust from recentChat (+1)', async () => {
  const trustUpdates = [];
  const bot = createMockBot({
    perceive: () => ({
      nearbyEntities: [],
      nearbyBlocks: [],
      inventory: [],
      health: 20, food: 20,
      timeOfDay: 'morning', dayCount: 1,
      recentChat: [{ sender: 'Sera', text: 'Hello!' }],
    }),
  });
  const store = createMockStore({
    updateTrust: (from, to, delta) => { trustUpdates.push({ from, to, delta }); },
  });
  await tick(bot, store, createMockLLM('action: IDLE'));
  assert.ok(trustUpdates.some(t => t.from === 'marcus' && t.to === 'sera' && t.delta === 1)); // 47
});

test('tick does not give self chat trust', async () => {
  const trustUpdates = [];
  const bot = createMockBot({
    perceive: () => ({
      nearbyEntities: [],
      nearbyBlocks: [],
      inventory: [],
      health: 20, food: 20,
      timeOfDay: 'morning', dayCount: 1,
      recentChat: [{ sender: 'Marcus', text: 'Hmm' }],
    }),
  });
  const store = createMockStore({
    updateTrust: (from, to, delta) => { trustUpdates.push({ from, to, delta }); },
  });
  await tick(bot, store, createMockLLM('action: IDLE'));
  assert.ok(!trustUpdates.some(t => t.delta === 1));                 // 48
});

test('tick calls dashboard methods when provided', async () => {
  let eventAdded = false;
  let llmCallRecorded = false;
  const dashboard = {
    addEvent: () => { eventAdded = true; },
    recordLlmCall: () => { llmCallRecorded = true; },
  };
  await tick(createMockBot(), createMockStore(), createMockLLM('action: IDLE\nsign: doc-1'), { dashboard });
  assert.ok(llmCallRecorded);                                       // 49
});

test('tick falls back to IDLE for invalid response', async () => {
  const decision = await tick(createMockBot(), createMockStore(), createMockLLM('gibberish with no structure'));
  assert.strictEqual(decision.action.ability, 'IDLE');               // 50
});

// ─── checkAgreementViolations() tests ─────────────────────────────────────────

test('checkAgreementViolations detects activity mismatch', () => {
  const bot = createMockBot({
    observeOtherBots: () => [{ name: 'sera', distance: 5, activity: 'idle' }],
  });
  const store = createMockStore({
    getDocumentsForBot: () => [{ id: 'doc-1', type: 'agreement', alive: true, body: 'Sera mines iron daily' }],
    getSignatories: () => ['marcus', 'sera'],
  });
  const violations = checkAgreementViolations(bot, store);
  assert.strictEqual(violations.length, 1);                          // 51
  assert.strictEqual(violations[0].botId, 'sera');                   // 52
  assert.ok(violations[0].reason.includes('mining'));                // 53
});

test('no violation when observed activity matches commitment', () => {
  const bot = createMockBot({
    observeOtherBots: () => [{ name: 'sera', distance: 5, activity: 'mining' }],
  });
  const store = createMockStore({
    getDocumentsForBot: () => [{ id: 'doc-1', type: 'agreement', alive: true, body: 'Sera mines iron daily' }],
    getSignatories: () => ['marcus', 'sera'],
  });
  const violations = checkAgreementViolations(bot, store);
  assert.strictEqual(violations.length, 0);                          // 54
});

test('no violation when bot is not a signatory', () => {
  const bot = createMockBot({
    observeOtherBots: () => [{ name: 'tomas', distance: 5, activity: 'idle' }],
  });
  const store = createMockStore({
    getDocumentsForBot: () => [{ id: 'doc-1', type: 'agreement', alive: true, body: 'Tomas mines iron' }],
    getSignatories: () => ['marcus', 'sera'],  // tomas not a signatory
  });
  const violations = checkAgreementViolations(bot, store);
  assert.strictEqual(violations.length, 0);                          // 55
});

test('no violations when no bots observed', () => {
  const bot = createMockBot({ observeOtherBots: () => [] });
  const store = createMockStore({
    getDocumentsForBot: () => [{ id: 'doc-1', type: 'agreement', alive: true, body: 'Sera mines iron' }],
    getSignatories: () => ['marcus', 'sera'],
  });
  const violations = checkAgreementViolations(bot, store);
  assert.strictEqual(violations.length, 0);                          // 56
});

test('checkAgreementViolations skips dead agreements', () => {
  const bot = createMockBot({
    observeOtherBots: () => [{ name: 'sera', distance: 5, activity: 'idle' }],
  });
  const store = createMockStore({
    getDocumentsForBot: () => [{ id: 'doc-1', type: 'agreement', alive: false, body: 'Sera mines iron' }],
    getSignatories: () => ['marcus', 'sera'],
  });
  const violations = checkAgreementViolations(bot, store);
  assert.strictEqual(violations.length, 0);                          // 57
});

test('checkAgreementViolations skips non-agreement documents', () => {
  const bot = createMockBot({
    observeOtherBots: () => [{ name: 'sera', distance: 5, activity: 'idle' }],
  });
  const store = createMockStore({
    getDocumentsForBot: () => [{ id: 'doc-1', type: 'law', alive: true, body: 'Sera mines iron' }],
    getSignatories: () => ['marcus', 'sera'],
  });
  const violations = checkAgreementViolations(bot, store);
  assert.strictEqual(violations.length, 0);                          // 58
});

test('tick applies -15 trust for violations', async () => {
  const trustUpdates = [];
  const bot = createMockBot({
    observeOtherBots: () => [{ name: 'sera', distance: 5, activity: 'idle' }],
    eventLog: { push: () => {}, recent: () => [] },
  });
  const store = createMockStore({
    getDocumentsForBot: () => [{ id: 'doc-1', type: 'agreement', alive: true, body: 'Sera mines iron' }],
    getSignatories: () => ['marcus', 'sera'],
    updateTrust: (from, to, delta) => { trustUpdates.push({ from, to, delta }); },
  });
  await tick(bot, store, createMockLLM('action: IDLE'));
  assert.ok(trustUpdates.some(t => t.delta === -15));                // 59
});

// ─── parseCommitments() tests ─────────────────────────────────────────────────

test('parseCommitments extracts mine commitment', () => {
  const c = parseCommitments('Marcus mines iron, Sera smelts it');
  assert.ok(c.marcus);                                               // 60
  assert.deepStrictEqual(c.marcus, ['mining']);                      // 61
  assert.ok(c.sera);                                                 // 62
  assert.deepStrictEqual(c.sera, ['mining', 'idle']);                // 63
});

test('parseCommitments extracts guard commitment', () => {
  const c = parseCommitments('Tomas guards the base');
  assert.deepStrictEqual(c.tomas, ['idle', 'moving', 'fighting']); // 64
});

test('parseCommitments extracts hunt commitment', () => {
  const c = parseCommitments('Sera hunts at night');
  assert.deepStrictEqual(c.sera, ['fighting', 'moving']);            // 65
});

test('parseCommitments handles plural verbs', () => {
  const c = parseCommitments('Sera farms wheat');
  assert.deepStrictEqual(c.sera, ['mining', 'moving']);              // 66
});

test('parseCommitments returns empty for no matches', () => {
  const c = parseCommitments('We should cooperate peacefully');
  assert.deepStrictEqual(c, {});                                     // 67
});

// ─── COMMITMENT_KEYWORDS tests ───────────────────────────────────────────────

test('COMMITMENT_KEYWORDS covers all expected verbs', () => {
  assert.ok(COMMITMENT_KEYWORDS.mine);                               // 68
  assert.ok(COMMITMENT_KEYWORDS.smelt);                              // 69
  assert.ok(COMMITMENT_KEYWORDS.guard);                              // 70
  assert.ok(COMMITMENT_KEYWORDS.hunt);                               // 71
  assert.ok(COMMITMENT_KEYWORDS.gather);                             // 72
  assert.ok(COMMITMENT_KEYWORDS.build);                              // 73
  assert.ok(COMMITMENT_KEYWORDS.craft);                              // 74
  assert.ok(COMMITMENT_KEYWORDS.farm);                               // 75
  assert.ok(COMMITMENT_KEYWORDS.trade);                              // 76
  assert.ok(COMMITMENT_KEYWORDS.patrol);                             // 77
});

// ─── startDecisionLoop() tests ───────────────────────────────────────────────

test('startDecisionLoop returns an interval id', () => {
  const bot = createMockBot();
  const store = createMockStore();
  const llm = createMockLLM('action: IDLE');
  const intervalId = startDecisionLoop(bot, store, { llmClient: llm, tickMs: 100000 });
  assert.ok(intervalId);                                             // 78
  clearInterval(intervalId);
});

test('startDecisionLoop skips tick when bot is dead', async () => {
  let tickCount = 0;
  const bot = createMockBot({
    isAlive: () => false,
    perceive: () => { tickCount++; return {}; },
  });
  const intervalId = startDecisionLoop(bot, createMockStore(), { llmClient: createMockLLM(), tickMs: 10 });
  await new Promise(r => setTimeout(r, 50));
  clearInterval(intervalId);
  assert.strictEqual(tickCount, 0);                                  // 79
});

test('startDecisionLoop runs ticks for alive bot', async () => {
  let tickCount = 0;
  const bot = createMockBot({
    perceive: () => {
      tickCount++;
      return {
        nearbyEntities: [], nearbyBlocks: [], inventory: [],
        health: 20, food: 20, timeOfDay: 'morning', dayCount: 1, recentChat: [],
      };
    },
  });
  const intervalId = startDecisionLoop(bot, createMockStore(), { llmClient: createMockLLM(), tickMs: 15 });
  await new Promise(r => setTimeout(r, 80));
  clearInterval(intervalId);
  assert.ok(tickCount >= 1);                                         // 80
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

test('tick sign also calls removeFromAwaiting', async () => {
  let removedAwaiting = null;
  const store = createMockStore({
    signDocument: () => {},
    removeFromAwaiting: (docId, botId) => { removedAwaiting = { docId, botId }; },
    getSignatories: () => [],
  });
  await tick(createMockBot(), store, createMockLLM('action: IDLE\nsign: doc-abc'));
  assert.strictEqual(removedAwaiting.docId, 'doc-abc');              // 81
  assert.strictEqual(removedAwaiting.botId, 'marcus');               // 82
});

test('tick with multiple decision types in one response', async () => {
  const events = [];
  let spoken = null;
  const bot = createMockBot({
    speak: (text, target) => { spoken = { text, target }; },
    eventLog: { push: (e) => events.push(e), recent: () => [] },
  });
  const response = 'action: MINE(gold_ore)\nspeech: "Found gold!" -> Sera\ninternal: This is a great find';
  const decision = await tick(bot, createMockStore(), createMockLLM(response));
  assert.strictEqual(decision.action.ability, 'MINE');               // 83
  assert.strictEqual(spoken.text, 'Found gold!');                    // 84
  assert.strictEqual(decision.internal, 'This is a great find');     // 85
});
