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

module.exports = { startDecisionLoop, tick };
