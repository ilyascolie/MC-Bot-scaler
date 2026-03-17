'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { parseResponse, isValid } = require('../src/core/llm/response-parser');

test('parses action with params', () => {
  const r = parseResponse('action: MINE(iron_ore)');
  assert.deepStrictEqual(r.action, { ability: 'MINE', params: ['iron_ore'] });
});

test('parses action without params', () => {
  const r = parseResponse('action: IDLE');
  assert.deepStrictEqual(r.action, { ability: 'IDLE', params: [] });
});

test('parses speech with target', () => {
  const r = parseResponse('speech: "Hello there" -> Marcus');
  assert.deepStrictEqual(r.speech, { text: 'Hello there', target: 'Marcus' });
});

test('parses speech without target', () => {
  const r = parseResponse('speech: "Just thinking aloud"');
  assert.deepStrictEqual(r.speech, { text: 'Just thinking aloud', target: null });
});

test('handles arrow variants', () => {
  const r1 = parseResponse('speech: "Hi" => Marcus');
  assert.strictEqual(r1.speech.target, 'Marcus');
  const r2 = parseResponse('speech: "Hi" → Marcus');
  assert.strictEqual(r2.speech.target, 'Marcus');
});

test('parses internal thought', () => {
  const r = parseResponse('internal: "I don\'t trust them"');
  assert.strictEqual(r.internal, "I don't trust them");
});

test('parses propose', () => {
  const r = parseResponse('propose: agreement | pair | We share iron equally');
  assert.deepStrictEqual(r.propose, { type: 'agreement', scope: 'pair', body: 'We share iron equally' });
});

test('parses challenge', () => {
  const r = parseResponse('challenge: doc-123 | This is unfair to miners');
  assert.deepStrictEqual(r.challenge, { documentId: 'doc-123', reason: 'This is unfair to miners' });
});

test('parses sign', () => {
  const r = parseResponse('sign: doc-456');
  assert.strictEqual(r.sign, 'doc-456');
});

test('parses reject', () => {
  const r = parseResponse('reject: doc-789');
  assert.strictEqual(r.reject, 'doc-789');
});

test('parses multi-line response', () => {
  const r = parseResponse(`Some preamble text
action: MINE(iron_ore)
speech: "Found iron!" -> Sera
internal: "This vein looks rich"
propose: agreement | pair | I mine, you smelt`);
  assert.strictEqual(r.action.ability, 'MINE');
  assert.strictEqual(r.speech.text, 'Found iron!');
  assert.strictEqual(r.speech.target, 'Sera');
  assert.ok(r.internal.includes('rich'));
  assert.strictEqual(r.propose.type, 'agreement');
});

test('handles null/empty input', () => {
  assert.deepStrictEqual(parseResponse(null).action, null);
  assert.deepStrictEqual(parseResponse('').action, null);
});

test('isValid requires at least one actionable field', () => {
  assert.ok(isValid({ action: { ability: 'IDLE', params: [] } }));
  assert.ok(!isValid({ action: null, speech: null, internal: 'thinking', propose: null, challenge: null, sign: null, reject: null }));
});

test('handles = delimiter', () => {
  const r = parseResponse('action= WANDER');
  assert.strictEqual(r.action.ability, 'WANDER');
});

test('multiple params', () => {
  const r = parseResponse('action: GO_TO(10, 64, -20)');
  assert.deepStrictEqual(r.action.params, ['10', '64', '-20']);
});
