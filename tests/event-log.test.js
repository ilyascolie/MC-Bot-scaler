'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const EventLog = require('../src/core/memory/event-log');

test('pushes and retrieves events', () => {
  const log = new EventLog(5);
  log.push({ type: 'action', data: 'mined' });
  log.push({ type: 'speech', data: 'hello' });
  assert.strictEqual(log.length, 2);
  const recent = log.recent(5);
  assert.strictEqual(recent.length, 2);
  assert.ok(recent[0].timestamp);
});

test('respects max size', () => {
  const log = new EventLog(3);
  for (let i = 0; i < 5; i++) log.push({ i });
  assert.strictEqual(log.length, 3);
  assert.strictEqual(log.recent()[0].i, 2);
});

test('clear empties buffer', () => {
  const log = new EventLog();
  log.push({ x: 1 });
  log.clear();
  assert.strictEqual(log.length, 0);
});
