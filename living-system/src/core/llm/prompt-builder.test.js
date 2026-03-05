const path = require('path');
const fs = require('fs');
const { buildDecisionPrompt } = require('./prompt-builder');
const { loadPersona } = require('../personality/persona');
const DocumentStore = require('../documents/store');
const EventLog = require('../memory/event-log');

const DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'test-prompt.db');
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

// ── Setup ────────────────────────────────────────────────────

const persona = loadPersona('marcus');
const bot = { persona, id: persona.id };

const store = new DocumentStore(DB_PATH);
store.init();

// Create some documents for Marcus
const institution = store.proposeDocument({
  type: 'institution',
  scope: 'village',
  body: 'The Village Compact: All residents share communal resources and resolve disputes by open discussion.',
  createdBy: 'marcus',
  createdAt: 10,
  awaiting: ['sera', 'dax'],
});
store.signDocument(institution.id, 'sera', 11);
store.signDocument(institution.id, 'dax', 12);

const norm = store.proposeDocument({
  type: 'norm',
  scope: 'group',
  body: 'No one takes more than 16 logs from the communal chest per day.',
  createdBy: 'marcus',
  createdAt: 20,
  awaiting: ['sera'],
});
store.signDocument(norm.id, 'sera', 21);

const agreement = store.proposeDocument({
  type: 'agreement',
  scope: 'pair',
  body: 'Marcus mines iron, Sera smelts it. Split ingots 50/50.',
  createdBy: 'marcus',
  createdAt: 30,
  awaiting: ['sera'],
});
store.signDocument(agreement.id, 'sera', 31);

const plan = store.createDocument({
  type: 'plan',
  scope: 'self',
  body: 'Build a watchtower on the hill east of camp before Day 5.',
  createdBy: 'marcus',
  createdAt: 40,
});

// Trust scores
store.updateTrust('marcus', 'sera', 35, 50);
store.updateTrust('marcus', 'dax', -20, 50);

// Event log
const eventLog = new EventLog();
eventLog.push('marcus', { type: 'action',      summary: 'Chopped 12 oak logs',         timestamp: 95 });
eventLog.push('marcus', { type: 'chat',         summary: 'Sera said: "Good morning!"',  timestamp: 96 });
eventLog.push('marcus', { type: 'observation',  summary: 'Zombie spotted 30 blocks east', timestamp: 97 });
eventLog.push('marcus', { type: 'action',      summary: 'Stored logs in communal chest', timestamp: 98 });
eventLog.push('marcus', { type: 'chat',         summary: 'Dax said: "Nice pile of iron you got there."', timestamp: 99 });
eventLog.push('marcus', { type: 'decision',     summary: 'Decided to scout the eastern hill', timestamp: 100 });

// Mock perception
const perception = {
  nearbyEntities: ['Sera (12 blocks)', 'Cow (8 blocks)', 'Zombie (30 blocks)'],
  nearbyBlocks: ['oak_log', 'iron_ore', 'stone', 'grass_block'],
  inventory: ['iron_pickaxe x1', 'oak_log x12', 'cooked_beef x4', 'cobblestone x34'],
  health: 18,
  hunger: 16,
  timeOfDay: 'morning',
  dayNumber: 3,
  recentChat: [
    '<Sera> Good morning!',
    '<Dax> Nice pile of iron you got there.',
    '<Marcus> We share around here, Dax.',
  ],
};

// ── Build prompt ─────────────────────────────────────────────

console.log('\n--- Building decision prompt for Marcus ---\n');

const prompt = buildDecisionPrompt(bot, perception, store, eventLog);

console.log('='.repeat(72));
console.log(prompt);
console.log('='.repeat(72));

// ── Assertions ───────────────────────────────────────────────

console.log('\n--- Verifying prompt structure ---\n');

// Section 1 — Identity
assert(prompt.includes('You are Marcus.'), 'contains persona name');
assert(prompt.includes('Former village elder'), 'contains backstory');
assert(prompt.includes('Kegan developmental level: 4/5'), 'contains Kegan level');
assert(prompt.includes('systems and principles'), 'contains Kegan 4 description');
assert(prompt.includes('Honesty: 0.9'), 'contains honesty score');
assert(prompt.includes('say what you mean'), 'contains high-honesty description');
assert(prompt.includes('Agreeableness: 0.3'), 'contains agreeableness score');
assert(prompt.includes('direct and willing to clash') || prompt.includes('blunt'),
  'contains low-agreeableness description');
assert(prompt.includes('You are in a Minecraft world'), 'contains world framing');

// Section 2 — Perception
assert(prompt.includes('You currently see:'), 'has perception header');
assert(prompt.includes('Sera (12 blocks)'), 'lists nearby entities');
assert(prompt.includes('iron_ore'), 'lists nearby blocks');
assert(prompt.includes('iron_pickaxe x1'), 'lists inventory');
assert(prompt.includes('18/20'), 'shows health');
assert(prompt.includes('morning'), 'shows time of day');
assert(prompt.includes('Day 3'), 'shows day number');
assert(prompt.includes('<Sera> Good morning!'), 'includes chat');

// Section 3 — Document tree
assert(prompt.includes('commitments and social context'), 'has document section header');
assert(prompt.includes('[INSTITUTION/village]'), 'includes institution');
assert(prompt.includes('[NORM/group]'), 'includes norm');
assert(prompt.includes('[AGREEMENT/pair]'), 'includes agreement');
assert(prompt.includes('[PLAN/self]'), 'includes plan');

// Ordering: institution before plan in the output
const instIdx = prompt.indexOf('[INSTITUTION');
const planIdx = prompt.indexOf('[PLAN');
assert(instIdx < planIdx, 'institution appears before plan');

// Section 4 — Trust
assert(prompt.includes('trust in others'), 'has trust section header');
assert(prompt.includes('sera: +35'), 'shows sera trust');
assert(prompt.includes('dax: -20'), 'shows dax trust');

// Section 5 — Memory
assert(prompt.includes('Recent events you remember'), 'has memory header');
assert(prompt.includes('Chopped 12 oak logs'), 'memory includes action');
assert(prompt.includes('Zombie spotted'), 'memory includes observation');

// Section 6 — Action request
assert(prompt.includes('What do you do now?'), 'has action request header');
assert(prompt.includes('action: ABILITY_NAME'), 'explains action format');
assert(prompt.includes('speech:'), 'explains speech format');
assert(prompt.includes('internal:'), 'explains internal format');
assert(prompt.includes('propose:'), 'explains propose format');
assert(prompt.includes('challenge:'), 'explains challenge format');
assert(prompt.includes('CHOP_TREES'), 'lists CHOP_TREES ability');
assert(prompt.includes('BUILD_SHELTER'), 'lists BUILD_SHELTER ability');

// Overall coherence — prompt should be a reasonable length
const lineCount = prompt.split('\n').length;
assert(lineCount > 30, `prompt has reasonable length (${lineCount} lines)`);
assert(lineCount < 200, `prompt is not excessively long (${lineCount} lines)`);

// ── Cleanup ──────────────────────────────────────────────────

store.close();
fs.unlinkSync(DB_PATH);

console.log(`\n========================================`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
