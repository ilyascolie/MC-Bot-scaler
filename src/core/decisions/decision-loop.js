'use strict';

const { buildPrompt } = require('../llm/prompt-builder');
const { parseResponse, isValid } = require('../llm/response-parser');

// Commitment keywords for agreement violation detection
const COMMITMENT_KEYWORDS = {
  mine: ['mining'],
  smelt: ['mining', 'idle'],   // smelting looks like mining or idle
  guard: ['idle', 'moving', 'fighting'],
  hunt: ['fighting', 'moving'],
  gather: ['mining', 'moving'],
  build: ['mining', 'idle'],
  craft: ['idle'],
  farm: ['mining', 'moving'],
  trade: ['idle', 'moving'],
  patrol: ['moving'],
};

/**
 * Single tick of a bot's decision cycle.
 * Returns the parsed decision for logging purposes.
 */
async function tick(bot, store, llmClient, options = {}) {
  const { conversationLogger, dashboard } = options;
  const startTime = Date.now();
  const botId = bot.persona.id;

  // Step 1: PERCEIVE
  const perception = bot.perceive();

  // Step 2: CHECK PENDING PROPOSALS
  const pending = store.getPendingProposals(botId);

  // Step 3: BUILD PROMPT
  const documentTree = store.getDocumentTree(botId);
  const trustMap = store.getTrustMap(botId);
  const recentEvents = bot.eventLog.recent(10);

  const prompt = buildPrompt({
    persona: bot.persona,
    perception,
    documentTree,
    trustMap,
    recentEvents,
  });

  // Inject pending proposals into prompt
  let fullPrompt = prompt;
  if (pending.length > 0) {
    fullPrompt += '\n\n=== PENDING PROPOSALS (respond with sign: or reject: for each) ===\n';
    for (const doc of pending) {
      fullPrompt += `  [${doc.id}] ${doc.type} (${doc.scope}): ${doc.body}\n`;
    }
  }

  // Step 4: CALL LLM
  // Use strategic model for K4+ bots or when pending proposals exist
  let rawResponse;
  try {
    const useStrategic = (bot.persona.kegan_level >= 4 || pending.length > 0) && llmClient.generateStrategic;
    if (useStrategic) {
      rawResponse = await llmClient.generateStrategic(fullPrompt);
    } else {
      rawResponse = await llmClient.generate(fullPrompt);
    }
  } catch (err) {
    // LLM failure — fallback to IDLE
    bot.eventLog.push({ type: 'llm_error', data: err.message, tick: Date.now() });
    return { action: { ability: 'IDLE', params: [] }, speech: null, internal: null, propose: null, challenge: null, sign: null, reject: null };
  }

  // Step 5: PARSE RESPONSE
  const decision = parseResponse(rawResponse);
  if (!isValid(decision)) {
    decision.action = { ability: 'IDLE', params: [] };
  }

  // Step 6: EXECUTE ALL DECISION TYPES

  // 6a: Execute action
  if (decision.action) {
    try {
      await bot.executeAction(decision.action);
      bot.eventLog.push({ type: 'action', data: `${decision.action.ability}(${decision.action.params.join(',')})`, tick: Date.now() });
    } catch (err) {
      bot.eventLog.push({ type: 'action_error', data: `${decision.action.ability} failed: ${err.message}`, tick: Date.now() });
    }
  }

  // 6b: Execute speech
  if (decision.speech) {
    bot.speak(decision.speech.text, decision.speech.target);
    bot.eventLog.push({ type: 'speech', data: `"${decision.speech.text}"${decision.speech.target ? ' -> ' + decision.speech.target : ''}`, tick: Date.now() });
  }

  // 6c: Log internal thought
  if (decision.internal) {
    bot.eventLog.push({ type: 'internal', data: decision.internal, tick: Date.now() });
  }

  // 6d: Handle propose
  if (decision.propose) {
    const { type, scope, body } = decision.propose;
    // Find nearby bots to be signatories
    const nearbyPlayers = perception.nearbyEntities
      .filter(e => e.type === 'player')
      .map(e => e.name.toLowerCase());

    const doc = {
      type, scope, body,
      created_by: botId,
      awaiting: nearbyPlayers.filter(n => n !== botId),
    };
    store.proposeDocument(doc);
    bot.eventLog.push({ type: 'propose', data: `${type}: ${body}`, tick: Date.now() });
    if (dashboard) dashboard.addEvent(`${bot.persona.name} proposed: ${body.slice(0, 50)}`);
  }

  // 6e: Handle challenge
  if (decision.challenge) {
    store.challengeDocument(decision.challenge.documentId, botId, decision.challenge.reason);
    bot.eventLog.push({ type: 'challenge', data: `Challenged ${decision.challenge.documentId}: ${decision.challenge.reason}`, tick: Date.now() });
    // Trust penalty for challenging
    const doc = store.getSignatories?.(decision.challenge.documentId) || [];
    for (const sigId of doc) {
      if (sigId !== botId) {
        store.updateTrust(botId, sigId, -2, Date.now());
      }
    }
    if (dashboard) dashboard.addEvent(`${bot.persona.name} challenged a document`);
  }

  // 6f: Handle sign
  if (decision.sign) {
    store.signDocument(decision.sign, botId, Date.now());
    store.removeFromAwaiting(decision.sign, botId);
    // Trust bonus for signing
    const signatories = store.getSignatories?.(decision.sign) || [];
    for (const sigId of signatories) {
      if (sigId !== botId) {
        store.updateTrust(botId, sigId, 5, Date.now());
        store.updateTrust(sigId, botId, 5, Date.now());
      }
    }
    bot.eventLog.push({ type: 'sign', data: `Signed ${decision.sign}`, tick: Date.now() });
    if (dashboard) dashboard.addEvent(`${bot.persona.name} signed a document`);
  }

  // 6g: Handle reject
  if (decision.reject) {
    store.removeFromAwaiting(decision.reject, botId);
    // Small trust penalty for rejection
    const signatories = store.getSignatories?.(decision.reject) || [];
    for (const sigId of signatories) {
      if (sigId !== botId) {
        store.updateTrust(botId, sigId, -2, Date.now());
      }
    }
    bot.eventLog.push({ type: 'reject', data: `Rejected ${decision.reject}`, tick: Date.now() });
    if (dashboard) dashboard.addEvent(`${bot.persona.name} rejected a proposal`);
  }

  // 6h: Check agreement violations via observation
  try {
    const violations = checkAgreementViolations(bot, store);
    for (const v of violations) {
      store.updateTrust(botId, v.botId, -15, Date.now());
      bot.eventLog.push({ type: 'violation', data: `${v.name} may be violating our agreement: ${v.reason}`, tick: Date.now() });
    }
  } catch {}

  // 6i: Passive trust from nearby chat
  for (const msg of perception.recentChat || []) {
    const senderId = msg.sender.toLowerCase();
    if (senderId !== botId) {
      store.updateTrust(botId, senderId, 1, Date.now());
    }
  }

  // Step 7: LOG
  const elapsed = Date.now() - startTime;
  if (dashboard) dashboard.recordLlmCall(elapsed);
  if (conversationLogger) {
    conversationLogger.logTick({
      botName: bot.persona.name,
      perception,
      decision,
      documentTree,
      trustMap,
      elapsed,
      dayCount: perception.dayCount,
      timeOfDay: perception.timeOfDay,
    });
  }

  return decision;
}

/**
 * Check if nearby bots are violating their agreements with this bot.
 */
function checkAgreementViolations(bot, store) {
  const botId = bot.persona.id;
  const observations = bot.observeOtherBots();
  if (observations.length === 0) return [];

  const violations = [];
  const agreements = store.getDocumentsForBot(botId).filter(d => d.type === 'agreement' && d.alive);

  for (const agreement of agreements) {
    const commitments = parseCommitments(agreement.body);
    const signatories = store.getSignatories(agreement.id);

    for (const obs of observations) {
      const obsId = obs.name.toLowerCase();
      if (obsId === botId) continue;
      if (!signatories.includes(obsId)) continue;

      const expectedActivities = commitments[obsId];
      if (!expectedActivities) continue;

      if (!expectedActivities.includes(obs.activity)) {
        violations.push({
          botId: obsId,
          name: obs.name,
          reason: `Expected ${expectedActivities.join('/')} but observed ${obs.activity}`,
          agreementId: agreement.id,
        });
      }
    }
  }

  return violations;
}

/**
 * Extract expected activities per bot from agreement text.
 */
function parseCommitments(body) {
  const commitments = {};
  const lower = body.toLowerCase();

  // Pattern: "Name verb..." — extract name and map verb to expected activities
  const namePattern = /([a-z]+)\s+(mines?|smelts?|guards?|hunts?|gathers?|builds?|crafts?|farms?|trades?|patrols?)/gi;
  let match;
  while ((match = namePattern.exec(lower)) !== null) {
    const name = match[1];
    const verb = match[2].replace(/s$/, ''); // normalize plural
    const activities = COMMITMENT_KEYWORDS[verb];
    if (activities) {
      commitments[name] = activities;
    }
  }

  return commitments;
}

/**
 * Start the decision loop for a bot. Returns intervalId for cleanup.
 */
function startDecisionLoop(bot, store, options = {}) {
  const { llmClient, tickMs = 4000, conversationLogger, dashboard } = options;
  let running = false;

  const intervalId = setInterval(async () => {
    if (running) return; // Guard against overlapping ticks
    if (!bot.isAlive()) return;

    running = true;
    try {
      await tick(bot, store, llmClient, { conversationLogger, dashboard });
    } catch (err) {
      console.error(`[${bot.persona.name}] Tick error:`, err.message);
    } finally {
      running = false;
    }
  }, tickMs);

  return intervalId;
}

module.exports = { tick, startDecisionLoop, checkAgreementViolations, parseCommitments, COMMITMENT_KEYWORDS };
