const { parseResponse, isValid } = require('./response-parser');

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

function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Sample 1: Full response with all fields ──────────────────

console.log('\n--- Sample 1: All fields present ---');

const r1 = parseResponse(`
action: gatherWood(oak, 16)
speech: "Hey Sera, want to help me collect wood?" → sera
internal: "I need wood before nightfall. Sera is nearby and friendly."
propose: agreement | pair | We share wood gathered today equally
challenge: doc-abc-123 | This norm is too restrictive for solo players
`);

assert(deepEq(r1.action, { ability: 'gatherWood', params: ['oak', '16'] }),
  'action parsed: gatherWood(oak, 16)');
assert(r1.speech.text === 'Hey Sera, want to help me collect wood?',
  'speech text parsed');
assert(r1.speech.target === 'sera',
  'speech target is sera');
assert(r1.internal === 'I need wood before nightfall. Sera is nearby and friendly.',
  'internal thought parsed');
assert(deepEq(r1.propose, { type: 'agreement', scope: 'pair', body: 'We share wood gathered today equally' }),
  'propose parsed');
assert(deepEq(r1.challenge, { documentId: 'doc-abc-123', reason: 'This norm is too restrictive for solo players' }),
  'challenge parsed');
assert(isValid(r1), 'full response is valid');

// ─── Sample 2: Action only (minimal response) ─────────────────

console.log('\n--- Sample 2: Action only ---');

const r2 = parseResponse(`action: idle`);

assert(deepEq(r2.action, { ability: 'idle', params: [] }),
  'bare action parsed: idle');
assert(r2.speech === null, 'speech is null');
assert(r2.internal === null, 'internal is null');
assert(r2.propose === null, 'propose is null');
assert(r2.challenge === null, 'challenge is null');
assert(isValid(r2), 'action-only is valid');

// ─── Sample 3: Speech + internal, no action ───────────────────

console.log('\n--- Sample 3: Speech + internal, no action ---');

const r3 = parseResponse(`
speech: "Does anyone have spare iron?"
internal: "I'm running low on tools but don't want to seem desperate."
`);

assert(r3.action === null, 'action is null');
assert(r3.speech.text === 'Does anyone have spare iron?', 'speech text parsed');
assert(r3.speech.target === null, 'speech target is null (broadcast)');
assert(r3.internal === "I'm running low on tools but don't want to seem desperate.",
  'internal parsed');
assert(isValid(r3), 'speech-only is valid');

// ─── Sample 4: Propose a group norm ───────────────────────────

console.log('\n--- Sample 4: Propose a norm ---');

const r4 = parseResponse(`
action: follow(marcus)
speech: "I think we need a rule about this." → marcus
internal: "Marcus will back me on this."
propose: norm | group | No one mines diamonds without announcing it to the group first
`);

assert(deepEq(r4.action, { ability: 'follow', params: ['marcus'] }),
  'action parsed: follow(marcus)');
assert(r4.speech.target === 'marcus', 'speech directed at marcus');
assert(r4.propose.type === 'norm', 'propose type is norm');
assert(r4.propose.scope === 'group', 'propose scope is group');
assert(r4.propose.body === 'No one mines diamonds without announcing it to the group first',
  'propose body parsed');

// ─── Sample 5: Messy LLM output with extra text ──────────────

console.log('\n--- Sample 5: Messy output with preamble ---');

const r5 = parseResponse(`
Okay, thinking about what to do next...

action: attack(zombie)
internal: "There's a zombie coming straight at me. Fight or flight? Fight."

I chose to fight because the zombie is blocking my path.
`);

assert(deepEq(r5.action, { ability: 'attack', params: ['zombie'] }),
  'action extracted despite preamble');
assert(r5.internal === "There's a zombie coming straight at me. Fight or flight? Fight.",
  'internal extracted despite trailing text');
assert(r5.speech === null, 'speech null (not present in messy output)');
assert(r5.propose === null, 'propose null');
assert(isValid(r5), 'messy output is still valid');

// ─── Sample 6: Completely empty / garbage ─────────────────────

console.log('\n--- Sample 6: Empty response ---');

const r6 = parseResponse('');
assert(r6.action === null, 'empty → action null');
assert(!isValid(r6), 'empty response is not valid');

const r7 = parseResponse('I have no idea what to do.');
assert(r7.action === null, 'garbage → action null');
assert(!isValid(r7), 'garbage response is not valid');

// ─── Sample 7: Arrow variants for speech ──────────────────────

console.log('\n--- Sample 7: Arrow variants ---');

const r7a = parseResponse(`speech: "Hello there" -> dax`);
assert(r7a.speech.text === 'Hello there', '-> arrow: text parsed');
assert(r7a.speech.target === 'dax', '-> arrow: target parsed');

const r7b = parseResponse(`speech: "Watch out!" => bron`);
assert(r7b.speech.text === 'Watch out!', '=> arrow: text parsed');
assert(r7b.speech.target === 'bron', '=> arrow: target parsed');

// ─── Done ─────────────────────────────────────────────────────

console.log(`\n========================================`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
