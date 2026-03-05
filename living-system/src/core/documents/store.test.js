const path = require('path');
const fs = require('fs');
const DocumentStore = require('./store');

const DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'test-store.db');

// Clean up any leftover test DB
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const store = new DocumentStore(DB_PATH);
store.init();

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

// ─── Test 1: Create a plan (self-scope, single signatory) ──────────

console.log('\n--- Test 1: Create a plan ---');

const plan = store.createDocument({
  type: 'plan',
  scope: 'self',
  body: 'Gather 64 oak logs before nightfall.',
  createdBy: 'marcus',
  createdAt: 100,
});

assert(plan.id && plan.id.length > 0, 'plan has an id');
assert(plan.type === 'plan', 'plan type is "plan"');
assert(plan.alive === true, 'plan is alive');

const marcusDocs = store.getDocumentsForBot('marcus');
assert(marcusDocs.length === 1, 'marcus has 1 document');
assert(marcusDocs[0].id === plan.id, 'marcus doc is the plan');

// ─── Test 2: Create an agreement (pair-scope, 2 signatories) ──────

console.log('\n--- Test 2: Create an agreement ---');

const agreement = store.proposeDocument({
  type: 'agreement',
  scope: 'pair',
  body: 'Marcus and Sera agree to share food equally.',
  createdBy: 'marcus',
  createdAt: 200,
  awaiting: ['sera'],
});

assert(agreement.awaiting.length === 1, 'agreement awaits 1 bot');
assert(agreement.awaiting[0] === 'sera', 'agreement awaits sera');

// Sera hasn't signed yet — she shouldn't see it
const seraDocsBefore = store.getDocumentsForBot('sera');
assert(seraDocsBefore.length === 0, 'sera has 0 documents before signing');

// Sera signs
const signed = store.signDocument(agreement.id, 'sera', 210);
assert(signed === true, 'sera signature was new');

// Now sera should see it
const seraDocsAfter = store.getDocumentsForBot('sera');
assert(seraDocsAfter.length === 1, 'sera has 1 document after signing');
assert(seraDocsAfter[0].type === 'agreement', 'sera doc is the agreement');

// Duplicate sign returns false
const dup = store.signDocument(agreement.id, 'sera', 220);
assert(dup === false, 'duplicate signature returns false');

// ─── Test 3: Create a norm (group-scope, 3 signatories) ───────────

console.log('\n--- Test 3: Create a norm ---');

const norm = store.proposeDocument({
  type: 'norm',
  scope: 'group',
  body: 'No stealing from shared chests.',
  createdBy: 'marcus',
  createdAt: 300,
  awaiting: ['sera', 'dax'],
});

store.signDocument(norm.id, 'sera', 310);
store.signDocument(norm.id, 'dax', 320);

// ─── Test 4: Create an institution (higher priority than norm) ─────

console.log('\n--- Test 4: Create an institution ---');

const institution = store.proposeDocument({
  type: 'institution',
  scope: 'village',
  body: 'The Village Council decides disputes by majority vote.',
  createdBy: 'marcus',
  createdAt: 50,
  awaiting: ['sera', 'dax'],
});

store.signDocument(institution.id, 'sera', 60);
store.signDocument(institution.id, 'dax', 70);

// ─── Test 5: Ordering — getDocumentsForBot returns correct order ───

console.log('\n--- Test 5: Document ordering ---');

const marcusAll = store.getDocumentsForBot('marcus');
assert(marcusAll.length === 4, `marcus has 4 documents (got ${marcusAll.length})`);

const types = marcusAll.map((d) => d.type);
console.log(`  order: ${types.join(' → ')}`);
assert(types[0] === 'institution', 'first is institution');
assert(types[1] === 'norm', 'second is norm');
assert(types[2] === 'agreement', 'third is agreement');
assert(types[3] === 'plan', 'fourth is plan');

// ─── Test 6: Document tree output ──────────────────────────────────

console.log('\n--- Test 6: Document tree ---');

const tree = store.getDocumentTree('marcus');
console.log('\n' + tree + '\n');

assert(tree.includes('[INSTITUTION/village]'), 'tree contains institution');
assert(tree.includes('[NORM/group]'), 'tree contains norm');
assert(tree.includes('[AGREEMENT/pair]'), 'tree contains agreement');
assert(tree.includes('[PLAN/self]'), 'tree contains plan');

// Institution should appear before plan in the output
const instPos = tree.indexOf('[INSTITUTION');
const planPos = tree.indexOf('[PLAN');
assert(instPos < planPos, 'institution appears before plan in tree');

// ─── Test 7: Parent-child hierarchy in tree ────────────────────────

console.log('--- Test 7: Parent-child hierarchy ---');

const childPlan = store.createDocument({
  type: 'plan',
  scope: 'self',
  parentId: norm.id,
  body: 'Enforce no-stealing norm by posting signs.',
  createdBy: 'marcus',
  createdAt: 400,
});

const treeWithChild = store.getDocumentTree('marcus');
assert(treeWithChild.includes('  [PLAN/self] Enforce'), 'child plan is indented under parent');

// ─── Test 8: Kill a document ───────────────────────────────────────

console.log('\n--- Test 8: Kill document ---');

store.killDocument(plan.id);
const afterKill = store.getDocumentsForBot('marcus');
assert(afterKill.every((d) => d.id !== plan.id), 'killed plan is excluded');

// ─── Test 9: Challenge a document ──────────────────────────────────

console.log('\n--- Test 9: Challenge document ---');

store.challengeDocument(norm.id, 'dax', 'This norm is unfair to loners', 500);
const daxDocs = store.getDocumentsForBot('dax');
const challenges = daxDocs.filter((d) => d.body.startsWith('CHALLENGE'));
assert(challenges.length === 1, 'dax has 1 challenge document');
assert(challenges[0].parentId === norm.id, 'challenge is child of norm');

// ─── Test 10: Trust scores ─────────────────────────────────────────

console.log('\n--- Test 10: Trust scores ---');

assert(store.getTrustScore('marcus', 'sera') === 0, 'default trust is 0');

store.updateTrust('marcus', 'sera', 25, 100);
assert(store.getTrustScore('marcus', 'sera') === 25, 'trust is 25 after +25');

store.updateTrust('marcus', 'sera', -10, 200);
assert(store.getTrustScore('marcus', 'sera') === 15, 'trust is 15 after -10');

store.updateTrust('marcus', 'dax', -50, 300);
const trustMap = store.getTrustMap('marcus');
assert(trustMap['sera'] === 15, 'trust map has sera=15');
assert(trustMap['dax'] === -50, 'trust map has dax=-50');

// Clamping
store.updateTrust('marcus', 'sera', 200, 400);
assert(store.getTrustScore('marcus', 'sera') === 100, 'trust clamped to 100');

store.updateTrust('marcus', 'dax', -200, 500);
assert(store.getTrustScore('marcus', 'dax') === -100, 'trust clamped to -100');

// ─── Done ──────────────────────────────────────────────────────────

store.close();
fs.unlinkSync(DB_PATH);

console.log(`\n========================================`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
