const { buildDecisionPrompt } = require('../llm/prompt-builder');
const { parseResponse, isValid } = require('../llm/response-parser');

/**
 * Run one perceive → prompt → call → parse → execute cycle for a bot.
 *
 * @param {import('../../bots/bot')} bot
 * @param {import('../documents/store')} store
 * @param {import('../llm/client')} llmClient
 * @param {import('../memory/event-log')} eventLog
 * @returns {Promise<import('../llm/response-parser').DecisionResult|null>}
 */
async function tick(bot, store, llmClient, eventLog) {
  const botId = bot.persona.id;

  // 1. PERCEIVE
  const perception = bot.perceive();

  // 2. CHECK PENDING PROPOSALS — inject into perception so the prompt mentions them
  const pending = store.getPendingProposals(botId);
  if (pending.length > 0) {
    const lines = pending.map(
      (d) => `[PENDING ${d.type.toUpperCase()}/${d.scope}] (id: ${d.id}) ${d.body}`
    );
    perception.pendingProposals = lines;
  }

  // 3. BUILD PROMPT
  const prompt = buildDecisionPrompt(bot, perception, store, eventLog);

  // 4. CALL LLM
  let rawText;
  try {
    rawText = await llmClient.generate(prompt);
  } catch (err) {
    eventLog.push(botId, {
      type: 'error',
      summary: `LLM call failed: ${err.message}`,
    });
    // Fallback: idle
    try { await bot.executeAction({ ability: 'IDLE', params: [] }); } catch (_) {}
    return null;
  }

  // 5. PARSE RESPONSE
  const decision = parseResponse(rawText);

  if (!isValid(decision)) {
    eventLog.push(botId, {
      type: 'decision',
      summary: 'LLM returned no actionable response — idling',
    });
    try { await bot.executeAction({ ability: 'IDLE', params: [] }); } catch (_) {}
    return decision;
  }

  // 6. EXECUTE

  // 6a. Action
  if (decision.action) {
    try {
      await bot.executeAction(decision.action);
      eventLog.push(botId, {
        type: 'action',
        summary: `Executed ${decision.action.ability}(${decision.action.params.join(', ')})`,
      });
    } catch (err) {
      eventLog.push(botId, {
        type: 'error',
        summary: `Action ${decision.action.ability} failed: ${err.message}`,
      });
    }
  }

  // 6b. Speech
  if (decision.speech) {
    try {
      bot.speak(decision.speech.text, decision.speech.target);
      eventLog.push(botId, {
        type: 'chat',
        summary: `Said: "${decision.speech.text}"${decision.speech.target ? ` → ${decision.speech.target}` : ''}`,
      });
    } catch (err) {
      eventLog.push(botId, {
        type: 'error',
        summary: `Speech failed: ${err.message}`,
      });
    }
  }

  // 6c. Internal thought — log only
  if (decision.internal) {
    eventLog.push(botId, {
      type: 'decision',
      summary: `Thought: "${decision.internal}"`,
    });
  }

  // 6d. Propose a new document
  if (decision.propose) {
    try {
      const doc = store.proposeDocument({
        type: decision.propose.type,
        scope: decision.propose.scope,
        body: decision.propose.body,
        createdBy: botId,
        createdAt: Date.now(),
        awaiting: [], // caller/orchestrator can fill in actual targets later
      });
      eventLog.push(botId, {
        type: 'decision',
        summary: `Proposed ${doc.type}/${doc.scope}: ${doc.body.slice(0, 80)}`,
      });
    } catch (err) {
      eventLog.push(botId, {
        type: 'error',
        summary: `Propose failed: ${err.message}`,
      });
    }
  }

  // 6e. Challenge a document
  if (decision.challenge) {
    try {
      store.challengeDocument(
        decision.challenge.documentId,
        botId,
        decision.challenge.reason,
        Date.now()
      );
      eventLog.push(botId, {
        type: 'decision',
        summary: `Challenged document ${decision.challenge.documentId}: ${decision.challenge.reason}`,
      });
      // Trust: challenging costs trust with the document's creator
      const challenged = store._getDoc ? store._getDoc.get(decision.challenge.documentId) : null;
      if (challenged && challenged.created_by && challenged.created_by !== botId) {
        store.updateTrust(botId, challenged.created_by, -2, Date.now());
      }
    } catch (err) {
      eventLog.push(botId, {
        type: 'error',
        summary: `Challenge failed: ${err.message}`,
      });
    }
  }

  // 6f. Sign a document
  if (decision.sign) {
    try {
      const signed = store.signDocument(decision.sign, botId, Date.now());
      if (signed) {
        eventLog.push(botId, {
          type: 'decision',
          summary: `Signed document ${decision.sign}`,
        });
        // Trust: signing boosts trust with creator
        const doc = store._getDoc ? store._getDoc.get(decision.sign) : null;
        if (doc && doc.created_by && doc.created_by !== botId) {
          store.updateTrust(botId, doc.created_by, 5, Date.now());
        }
      }
    } catch (err) {
      eventLog.push(botId, {
        type: 'error',
        summary: `Sign failed: ${err.message}`,
      });
    }
  }

  // 6g. Reject a document
  if (decision.reject) {
    try {
      store.removeFromAwaiting(decision.reject, botId);
      eventLog.push(botId, {
        type: 'decision',
        summary: `Rejected document ${decision.reject}`,
      });
      // Trust: rejecting slightly lowers trust with creator
      const doc = store._getDoc ? store._getDoc.get(decision.reject) : null;
      if (doc && doc.created_by && doc.created_by !== botId) {
        store.updateTrust(botId, doc.created_by, -2, Date.now());
      }
    } catch (err) {
      eventLog.push(botId, {
        type: 'error',
        summary: `Reject failed: ${err.message}`,
      });
    }
  }

  // 6h. OBSERVE other bots and check for agreement violations
  try {
    checkAgreementViolations(bot, store, eventLog);
  } catch (_) {
    // Observation is best-effort — never crash the tick
  }

  // 7. LOG — summary event for the overall tick
  eventLog.push(botId, {
    type: 'decision',
    summary: `Tick complete — action: ${decision.action?.ability || 'none'}, speech: ${decision.speech ? 'yes' : 'no'}`,
  });

  // 8. UPDATE TRUST from perception cues
  if (perception.recentChat && perception.recentChat.length > 0) {
    for (const line of perception.recentChat) {
      // Match "<Name> ..." chat lines
      const m = line.match(/^<(\w+)>/);
      if (m && m[1].toLowerCase() !== botId.toLowerCase()) {
        // Someone spoke to/near us → small trust bump
        store.updateTrust(botId, m[1].toLowerCase(), 1, Date.now());
      }
    }
  }

  return decision;
}

// ── Agreement keywords → expected activities ─────────────────────
// Maps keywords found in agreement bodies to activities that would
// satisfy the commitment. If a signatory is observed doing something
// NOT on their expected list, it's a potential violation.
const COMMITMENT_KEYWORDS = {
  mine:     ['mining', 'moving'],
  mines:    ['mining', 'moving'],
  mining:   ['mining', 'moving'],
  dig:      ['mining', 'moving'],
  smelt:    ['mining', 'moving', 'idle'], // smelting looks like idle/near furnace
  smelts:   ['mining', 'moving', 'idle'],
  build:    ['building', 'moving', 'mining'],
  builds:   ['building', 'moving', 'mining'],
  guard:    ['idle', 'moving', 'fighting'],
  guards:   ['idle', 'moving', 'fighting'],
  patrol:   ['moving'],
  patrols:  ['moving'],
  hunt:     ['fighting', 'moving'],
  hunts:    ['fighting', 'moving'],
  farm:     ['mining', 'moving', 'idle'],
  farms:    ['mining', 'moving', 'idle'],
  chop:     ['mining', 'moving'],
  chops:    ['mining', 'moving'],
  craft:    ['idle', 'moving'],
  crafts:   ['idle', 'moving'],
};

/**
 * Parse an agreement body to extract per-bot commitments.
 * Looks for patterns like "X mines", "X guards", "Y smelts", etc.
 *
 * @param {string} body — agreement body text
 * @returns {Map<string, string[]>} — map of lowercase bot name → expected activities
 */
function parseCommitments(body) {
  const commitments = new Map();
  const lower = body.toLowerCase();

  // Match patterns like "name verb" where verb is a commitment keyword
  for (const [keyword, activities] of Object.entries(COMMITMENT_KEYWORDS)) {
    // Match "Name keyword" — e.g., "Marcus mines", "Sera smelts"
    const pattern = new RegExp(`(\\w+)\\s+${keyword}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const name = match[1].toLowerCase();
      // Skip common words that aren't names
      if (['i', 'we', 'they', 'who', 'that', 'will', 'should', 'must', 'can', 'the', 'and', 'or'].includes(name)) continue;
      if (!commitments.has(name)) commitments.set(name, []);
      for (const act of activities) {
        if (!commitments.get(name).includes(act)) {
          commitments.get(name).push(act);
        }
      }
    }
  }

  return commitments;
}

/**
 * Observe nearby bots and check if any are violating agreements
 * this bot has signed with them.
 *
 * @param {import('../../bots/bot')} bot
 * @param {import('../documents/store')} store
 * @param {import('../memory/event-log')} eventLog
 */
function checkAgreementViolations(bot, store, eventLog) {
  const botId = bot.persona.id;

  // Get what other bots are doing
  const observations = bot.observeOtherBots();
  if (observations.length === 0) return;

  // Build a quick lookup: lowercase name → observation
  const obsMap = new Map();
  for (const obs of observations) {
    obsMap.set(obs.name.toLowerCase(), obs);
  }

  // Get this bot's agreements
  const docs = store.getDocumentsForBot(botId);
  const agreements = docs.filter((d) => d.type === 'agreement');
  if (agreements.length === 0) return;

  for (const agreement of agreements) {
    const commitments = parseCommitments(agreement.body);
    if (commitments.size === 0) continue;

    // Get the other signatories of this agreement
    const signatories = store.getSignatories(agreement.id);
    const otherSignatories = signatories.filter((id) => id !== botId);

    for (const otherBotId of otherSignatories) {
      // Is this bot nearby and observable?
      const obs = obsMap.get(otherBotId);
      if (!obs) continue; // not nearby, can't observe

      // Does the agreement say what this bot should be doing?
      const expectedActivities = commitments.get(otherBotId);
      if (!expectedActivities) continue; // no specific commitment for this bot

      // Is their observed activity consistent with their commitment?
      if (!expectedActivities.includes(obs.activity)) {
        // Potential violation detected!
        const summary = agreement.body.length > 60
          ? agreement.body.slice(0, 60) + '...'
          : agreement.body;

        eventLog.push(botId, {
          type: 'observation',
          summary: `${obs.name} may be violating our agreement about "${summary}" — expected ${expectedActivities.join('/')}, observed ${obs.activity}`,
        });

        // Trust penalty
        store.updateTrust(botId, otherBotId, -15, Date.now());
      }
    }
  }
}

/**
 * Start the decision loop for a bot.
 *
 * @param {import('../../bots/bot')} bot — connected Bot instance
 * @param {import('../documents/store')} store — DocumentStore instance
 * @param {object} settings
 * @param {import('../llm/client')} settings.llmClient — OllamaClient instance
 * @param {import('../memory/event-log')} settings.eventLog — EventLog instance
 * @param {number} [settings.tickMs=5000] — milliseconds between ticks
 * @returns {NodeJS.Timeout} — interval id (pass to clearInterval to stop)
 */
function startDecisionLoop(bot, store, { llmClient, eventLog, tickMs = 5000 }) {
  let running = false;

  const intervalId = setInterval(async () => {
    // Guard: skip if the previous tick is still running or bot is dead
    if (running) return;
    if (!bot.isAlive()) return;

    running = true;
    try {
      await tick(bot, store, llmClient, eventLog);
    } catch (err) {
      eventLog.push(bot.persona.id, {
        type: 'error',
        summary: `Tick crashed: ${err.message}`,
      });
    } finally {
      running = false;
    }
  }, tickMs);

  return intervalId;
}

module.exports = { startDecisionLoop, tick, checkAgreementViolations, parseCommitments };
