/**
 * PromptBuilder — constructs the 6-section decision prompt.
 *
 * Sections:
 *   1. IDENTITY — persona + Kegan + trait descriptions
 *   2. PERCEPTION — game state visible to the bot
 *   3. DOCUMENT TREE — commitments and social context
 *   4. TRUST — trust scores for known bots
 *   5. RECENT MEMORY — last events from EventLog
 *   6. ACTION REQUEST — available actions + response format
 */

// ── Kegan descriptions (instruction-style for the LLM) ──────

const KEGAN_DESCRIPTIONS = {
  1: 'You experience the world through impulses and perceptions. You cannot ' +
     'distinguish your feelings from external reality. You react rather than plan.',
  2: 'You think in terms of your concrete needs. You cooperate when it directly ' +
     'benefits you. You follow rules because of consequences, not understanding. ' +
     'If a better offer comes along, you take it.',
  3: 'You think in terms of relationships. You want to belong and be valued. ' +
     'You can\'t step outside your relationships to evaluate them. Conflicting ' +
     'loyalties paralyze you.',
  4: 'You think in terms of systems and principles. You evaluate social structures ' +
     'and propose improvements. You can disagree from a principled position. You may ' +
     'be rigid once committed to a principle.',
  5: 'You hold multiple frameworks simultaneously. You see limits of your own ' +
     'principles. You\'re comfortable with paradox. You can integrate opposing viewpoints.',
};

/**
 * Return a human-facing description for an honesty score.
 * @param {number} h — 0.0–1.0
 * @returns {string}
 */
function honestyDescription(h) {
  if (h >= 0.75) return 'You say what you mean and mean what you say. Deception feels wrong to you.';
  if (h >= 0.5)  return 'You prefer honesty but will bend the truth to avoid serious conflict or protect someone you care about.';
  if (h >= 0.3)  return 'You treat truth flexibly. You will mislead, omit, or spin facts when it serves a purpose.';
  return 'Your stated intentions may differ from your actual plans. You may say one thing and do another if it serves your interests.';
}

/**
 * Return a human-facing description for an agreeableness score.
 * @param {number} a — 0.0–1.0
 * @returns {string}
 */
function agreeablenessDescription(a) {
  if (a >= 0.75) return 'You strongly prefer harmony. You go along with the group and avoid confrontation.';
  if (a >= 0.5)  return 'You balance cooperation with standing your ground. You push back when it matters.';
  if (a >= 0.3)  return 'You are direct and willing to clash. You don\'t soften your positions for comfort.';
  return 'You are blunt, combative, or dismissive. You prioritize your view over group cohesion.';
}

// ── Section builders ─────────────────────────────────────────

function buildIdentity(persona) {
  const kDesc = KEGAN_DESCRIPTIONS[persona.kegan_level] || KEGAN_DESCRIPTIONS[3];
  const hDesc = honestyDescription(persona.honesty);
  const aDesc = agreeablenessDescription(persona.agreeableness);

  return `You are ${persona.name}. ${persona.backstory}

Your psychological profile:
- Kegan developmental level: ${persona.kegan_level}/5. ${kDesc}
- Honesty: ${persona.honesty}. ${hDesc}
- Agreeableness: ${persona.agreeableness}. ${aDesc}
- Risk tolerance: ${persona.risk_tolerance}
- Social drive: ${persona.social_drive}
- Self-awareness: ${persona.self_awareness}

You are in a Minecraft world. You must survive.`;
}

function buildPerception(p) {
  if (!p) return 'You currently see: (no perception data available)';

  const lines = ['You currently see:'];

  if (p.nearbyEntities && p.nearbyEntities.length > 0) {
    lines.push(`- Nearby entities: ${p.nearbyEntities.join(', ')}`);
  } else {
    lines.push('- Nearby entities: none');
  }

  if (p.nearbyBlocks && p.nearbyBlocks.length > 0) {
    lines.push(`- Nearby resources: ${p.nearbyBlocks.join(', ')}`);
  }

  if (p.inventory && p.inventory.length > 0) {
    lines.push(`- Your inventory: ${p.inventory.join(', ')}`);
  } else {
    lines.push('- Your inventory: empty');
  }

  const hp   = p.health   != null ? p.health   : '?';
  const food = p.hunger   != null ? p.hunger   : '?';
  lines.push(`- Your health: ${hp}/20, hunger: ${food}/20`);

  if (p.timeOfDay != null || p.dayNumber != null) {
    const time = p.timeOfDay ?? 'unknown';
    const day  = p.dayNumber ?? '?';
    lines.push(`- Time: ${time}, Day ${day}`);
  }

  if (p.recentChat && p.recentChat.length > 0) {
    lines.push(`- Recent chat:\n${p.recentChat.map((m) => `    ${m}`).join('\n')}`);
  }

  return lines.join('\n');
}

function buildDocumentSection(documentTree) {
  if (!documentTree || documentTree.trim() === '') {
    return 'Your commitments and social context:\nYou have no commitments or agreements yet.';
  }
  return `Your commitments and social context:\n${documentTree}`;
}

function buildTrustSection(trustMap) {
  if (!trustMap || Object.keys(trustMap).length === 0) {
    return 'Your trust in others:\nYou have not formed trust opinions yet.';
  }
  const lines = Object.entries(trustMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => `  ${name}: ${score > 0 ? '+' : ''}${score}`);
  return `Your trust in others:\n${lines.join('\n')}`;
}

function buildMemorySection(events) {
  if (!events || events.length === 0) {
    return 'Recent events you remember:\nNothing notable has happened yet.';
  }
  const lines = events.map((e) => {
    const tick = e.timestamp != null ? `[tick ${e.timestamp}]` : '';
    return `  ${tick} ${e.summary}`;
  });
  return `Recent events you remember:\n${lines.join('\n')}`;
}

function buildActionRequest() {
  return `What do you do now? Respond with any combination of:

action: ABILITY_NAME(parameters)
  Available abilities: IDLE, WANDER, GO_TO(x,y,z), FOLLOW(name), FLEE(name), MINE(block_type), PLACE(block_type,x,y,z), ATTACK(name), EAT, CRAFT(item), STORE(item), RETRIEVE(item), CHOP_TREES, BUILD_SHELTER

speech: "what you say" → target_name
  (leave out target for speaking to everyone nearby)

internal: "what you actually think but don't say"
  (this is private — no one else sees this)

propose: type | scope | body
  types: plan, agreement, norm, role, institution
  scopes: self, pair, group
  Example: propose: agreement | pair | I mine iron, you smelt it, we split the ingots 50/50

challenge: document_id | why you want to change or reject it

You don't have to use all fields. Most ticks you'll just have an action and maybe speech.`;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Build the complete decision prompt.
 *
 * @param {object}  bot          — { persona, id }
 * @param {object}  perception   — game-agnostic perception state
 * @param {import('../documents/store')} store — DocumentStore instance
 * @param {import('../memory/event-log')} eventLog — EventLog instance
 * @returns {string} — the full prompt (all 6 sections concatenated)
 */
function buildDecisionPrompt(bot, perception, store, eventLog) {
  const persona = bot.persona;
  const botId   = persona.id;

  // Section 1 — Identity
  const identity = buildIdentity(persona);

  // Section 2 — Perception
  const percep = buildPerception(perception);

  // Section 3 — Document tree
  const docTree = store.getDocumentTree(botId);
  const docs = buildDocumentSection(docTree);

  // Section 4 — Trust
  const trustMap = store.getTrustMap(botId);
  const trust = buildTrustSection(trustMap);

  // Section 5 — Recent memory
  const events = eventLog.recent(botId, 10);
  const memory = buildMemorySection(events);

  // Section 6 — Action request
  const action = buildActionRequest();

  return [identity, percep, docs, trust, memory, action].join('\n\n');
}

module.exports = {
  buildDecisionPrompt,
  // Exposed for testing individual sections
  buildIdentity,
  buildPerception,
  buildDocumentSection,
  buildTrustSection,
  buildMemorySection,
  buildActionRequest,
};
