const { buildPrompt, buildSystemPrompt } = require('../llm/prompt-builder');
const { parseResponse } = require('../llm/response-parser');

/**
 * DecisionLoop — the core perceive → prompt → call → parse → execute cycle.
 *
 * This is the heartbeat of each bot. On every tick:
 *   1. perceive  — ask the adapter for current game state
 *   2. prompt    — build the full LLM prompt from all context
 *   3. call      — send the prompt to the LLM
 *   4. parse     — extract structured decision from LLM response
 *   5. execute   — tell the adapter to perform the chosen action
 *
 * The loop is game-agnostic: it depends on AdapterInterface, not Minecraft.
 */

class DecisionLoop {
  /**
   * @param {object} deps
   * @param {import('../../adapters/adapter-interface')} deps.adapter
   * @param {import('../llm/client')}                    deps.llmClient
   * @param {import('../documents/store')}               deps.documentStore
   * @param {import('../memory/trust')}                  deps.trustTracker
   * @param {import('../memory/event-log')}              deps.eventLog
   * @param {import('../personality/persona').PersonaData} deps.persona
   * @param {number} [deps.tickMs=10000] — milliseconds between ticks
   */
  constructor({ adapter, llmClient, documentStore, trustTracker, eventLog, persona, tickMs = 10000 }) {
    this.adapter = adapter;
    this.llmClient = llmClient;
    this.documentStore = documentStore;
    this.trustTracker = trustTracker;
    this.eventLog = eventLog;
    this.persona = persona;
    this.tickMs = tickMs;

    /** @type {object|null} bot handle from adapter.connect() */
    this.bot = null;
    /** @type {NodeJS.Timeout|null} */
    this.timer = null;
    this.running = false;
  }

  /**
   * Connect the bot and start the decision loop.
   * @returns {Promise<void>}
   */
  async start() {
    // TODO: call adapter.connect(persona), store bot handle
    // TODO: set up interval timer that calls tick()
    throw new Error('DecisionLoop.start() not implemented');
  }

  /**
   * Execute one perceive → prompt → call → parse → execute cycle.
   * @returns {Promise<void>}
   */
  async tick() {
    // TODO: 1. const perception = await adapter.perceive(bot)
    // TODO: 2. gather trust scores, recent events, documents
    // TODO: 3. const prompt = buildPrompt({ persona, perception, ... })
    // TODO: 4. const response = await llmClient.generate({ prompt })
    // TODO: 5. const decision = parseResponse(response.text)
    // TODO: 6. await adapter.execute(bot, decision.action)
    // TODO: 7. if decision.speech, await adapter.speak(...)
    // TODO: 8. log event to eventLog
    // TODO: 9. if decision.journalEntry, persist document
    throw new Error('DecisionLoop.tick() not implemented');
  }

  /**
   * Stop the loop and disconnect.
   * @returns {Promise<void>}
   */
  async stop() {
    // TODO: clear interval, call adapter.disconnect(bot)
    throw new Error('DecisionLoop.stop() not implemented');
  }
}

module.exports = DecisionLoop;
