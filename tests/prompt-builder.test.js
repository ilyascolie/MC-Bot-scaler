'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { buildPrompt } = require('../src/core/llm/prompt-builder');

const mockPersona = {
  name: 'Marcus', backstory: 'A principled leader.',
  kegan_level: 4, honesty: 0.9, agreeableness: 0.6,
  risk_tolerance: 0.3, social_drive: 0.7, self_awareness: 0.8,
};

test('includes identity section', () => {
  const prompt = buildPrompt({ persona: mockPersona, perception: null, documentTree: '', trustMap: {}, recentEvents: [] });
  assert.ok(prompt.includes('Marcus'));
  assert.ok(prompt.includes('principled leader'));
  assert.ok(prompt.includes('Kegan 4'));
});

test('includes perception', () => {
  const prompt = buildPrompt({
    persona: mockPersona,
    perception: {
      nearbyEntities: [{ name: 'Sera', type: 'player', distance: 5 }],
      nearbyBlocks: ['iron_ore'],
      inventory: [{ name: 'wooden_sword', count: 1 }],
      health: 18, food: 16,
      timeOfDay: 'morning', dayCount: 3,
      recentChat: [{ sender: 'Sera', message: 'Good morning' }],
    },
    documentTree: '', trustMap: {}, recentEvents: [],
  });
  assert.ok(prompt.includes('Sera'));
  assert.ok(prompt.includes('iron_ore'));
  assert.ok(prompt.includes('18/20'));
  assert.ok(prompt.includes('morning'));
});

test('includes document tree', () => {
  const prompt = buildPrompt({ persona: mockPersona, perception: null, documentTree: '[institution] Village Council', trustMap: {}, recentEvents: [] });
  assert.ok(prompt.includes('Village Council'));
});

test('includes trust map', () => {
  const prompt = buildPrompt({ persona: mockPersona, perception: null, documentTree: '', trustMap: { Sera: 35, Dax: -12 }, recentEvents: [] });
  assert.ok(prompt.includes('Sera: +35'));
  assert.ok(prompt.includes('Dax: -12'));
});

test('includes action instructions', () => {
  const prompt = buildPrompt({ persona: mockPersona, perception: null, documentTree: '', trustMap: {}, recentEvents: [] });
  assert.ok(prompt.includes('action:'));
  assert.ok(prompt.includes('speech:'));
  assert.ok(prompt.includes('MINE'));
  assert.ok(prompt.includes('IDLE'));
});

test('honesty levels produce different text', () => {
  const honest = buildPrompt({ persona: { ...mockPersona, honesty: 0.9 }, perception: null, documentTree: '', trustMap: {}, recentEvents: [] });
  const dishonest = buildPrompt({ persona: { ...mockPersona, honesty: 0.2 }, perception: null, documentTree: '', trustMap: {}, recentEvents: [] });
  assert.ok(honest.includes('deeply honest'));
  assert.ok(dishonest.includes('deceptive'));
});
