'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadPersona, loadAllPersonas, listPersonas, validatePersona } = require('../src/core/personality/persona');

test('loads marcus persona', () => {
  const p = loadPersona('marcus');
  assert.strictEqual(p.id, 'marcus');
  assert.strictEqual(p.name, 'Marcus');
  assert.strictEqual(p.kegan_level, 4);
  assert.ok(p.honesty >= 0 && p.honesty <= 1);
});

test('loads all 10 personas', () => {
  const all = loadAllPersonas();
  assert.strictEqual(all.size, 10);
  assert.ok(all.has('marcus'));
  assert.ok(all.has('nyx'));
});

test('lists persona names', () => {
  const names = listPersonas();
  assert.strictEqual(names.length, 10);
  assert.ok(names.includes('marcus'));
});

test('validates required fields', () => {
  assert.throws(() => validatePersona({}), /Missing required field/);
});

test('validates kegan range', () => {
  assert.throws(() => validatePersona({
    id: 'test', name: 'Test', kegan_level: 6,
    honesty: 0.5, agreeableness: 0.5, risk_tolerance: 0.5,
    social_drive: 0.5, self_awareness: 0.5, backstory: 'test'
  }), /kegan_level/);
});

test('clamps out of range floats', () => {
  const p = validatePersona({
    id: 'test', name: 'Test', kegan_level: 3,
    honesty: 1.5, agreeableness: -0.1, risk_tolerance: 0.5,
    social_drive: 0.5, self_awareness: 0.5, backstory: 'test'
  });
  assert.strictEqual(p.honesty, 1);
  assert.strictEqual(p.agreeableness, 0);
});
