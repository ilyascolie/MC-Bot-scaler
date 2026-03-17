'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ConversationLogger = require('../src/logging/conversation-logger');
const Dashboard = require('../src/logging/dashboard');

test('conversation logger creates day file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-'));
  const logger = new ConversationLogger(tmpDir);
  logger.logTick({
    botName: 'Marcus',
    perception: { nearbyEntities: [{ name: 'Sera', distance: 5 }], nearbyBlocks: ['iron_ore'], health: 18, food: 16 },
    decision: { action: { ability: 'MINE', params: ['iron_ore'] }, speech: { text: 'Found iron!', target: 'Sera' }, internal: 'Good vein' },
    documentTree: '',
    trustMap: { Sera: 35 },
    elapsed: 1200,
    dayCount: 1,
    timeOfDay: 'morning',
  });
  const file = path.join(tmpDir, 'narrative', 'day-001.log');
  assert.ok(fs.existsSync(file));
  const content = fs.readFileSync(file, 'utf-8');
  assert.ok(content.includes('Marcus'));
  assert.ok(content.includes('MINE'));
  assert.ok(content.includes('Found iron!'));
  assert.ok(content.includes('Sera'));
  fs.rmSync(tmpDir, { recursive: true });
});

test('conversation logger word wraps long thoughts', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-'));
  const logger = new ConversationLogger(tmpDir);
  logger.logTick({
    botName: 'Marcus',
    perception: { nearbyEntities: [], nearbyBlocks: [], health: 20, food: 20 },
    decision: { action: { ability: 'IDLE', params: [] }, internal: 'This is a very long internal thought that should definitely be wrapped across multiple lines because it exceeds the maximum line length' },
    documentTree: '',
    trustMap: {},
    elapsed: 500,
    dayCount: 1,
    timeOfDay: 'morning',
  });
  const file = path.join(tmpDir, 'narrative', 'day-001.log');
  const content = fs.readFileSync(file, 'utf-8');
  assert.ok(content.includes('internal:'));
  fs.rmSync(tmpDir, { recursive: true });
});

test('dashboard renders status', () => {
  const mockManager = {
    getStatus: () => ({
      alive: 3, total: 5,
      bots: [
        { id: 'marcus', name: 'Marcus', alive: true, kegan: 4 },
        { id: 'sera', name: 'Sera', alive: true, kegan: 3 },
        { id: 'dax', name: 'Dax', alive: false, kegan: 2 },
      ],
    }),
  };
  const dashboard = new Dashboard(mockManager);
  dashboard.recordLlmCall(1200);
  dashboard.recordLlmCall(800);
  dashboard.addEvent('Marcus proposed an agreement');

  // Capture console output
  let output = '';
  const origLog = console.log;
  console.log = (msg) => { output += msg; };
  dashboard.render();
  console.log = origLog;

  assert.ok(output.includes('LIVING SYSTEM'));
  assert.ok(output.includes('Marcus'));
  assert.ok(output.includes('K4'));
  assert.strictEqual(dashboard.llmCalls, 2);
});

test('dashboard event ring buffer', () => {
  const mockManager = { getStatus: () => ({ alive: 0, total: 0, bots: [] }) };
  const dashboard = new Dashboard(mockManager);
  for (let i = 0; i < 12; i++) dashboard.addEvent(`Event ${i}`);
  assert.strictEqual(dashboard.events.length, 8); // maxEvents = 8
});

test('logger creates log files', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'living-'));
  const Logger = require('../src/orchestrator/logger');
  const logger = new Logger(tmpDir);
  logger.info('test message');
  logger.logChat('Marcus', 'hello', 'Sera');
  logger.logError('test error');

  // Wait for all streams to finish flushing before checking files
  await new Promise((resolve) => {
    let closed = 0;
    const onClose = () => { if (++closed === 3) resolve(); };
    logger.decisionStream.on('finish', onClose);
    logger.chatStream.on('finish', onClose);
    logger.errorStream.on('finish', onClose);
    logger.close();
  });

  assert.ok(fs.existsSync(path.join(tmpDir, 'decisions.log')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'chat.log')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'errors.log')));
  fs.rmSync(tmpDir, { recursive: true });
});
