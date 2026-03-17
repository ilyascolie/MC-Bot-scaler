'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const LLMClient = require('../src/core/llm/client');

test('throws on unknown provider', () => {
  assert.throws(() => new LLMClient({ provider: 'fake', routine: { model: 'x' }, strategic: { model: 'y' } }), /Unknown provider/);
});

test('creates client with ollama provider', () => {
  const client = new LLMClient({ provider: 'ollama', endpoint: 'http://localhost:11434', routine: { model: 'qwen2.5:8b' }, strategic: { model: 'qwen2.5:32b' }, temperature: 0.7, timeoutMs: 30000 });
  assert.ok(client.routine);
  assert.ok(client.strategic);
});

test('creates client with anthropic provider', () => {
  const client = new LLMClient({ provider: 'anthropic', apiKey: 'test-key', routine: { model: 'claude-3-haiku-20240307' }, strategic: { model: 'claude-3-sonnet-20240229' }, temperature: 0.7, timeoutMs: 30000 });
  assert.ok(client.routine);
});
