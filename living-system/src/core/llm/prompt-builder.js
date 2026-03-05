/**
 * PromptBuilder — constructs the decision prompt from all available state.
 *
 * Assembles the full LLM prompt by combining:
 *   1. Persona identity + Kegan level description
 *   2. Game meaning context (from adapter)
 *   3. Current perception state
 *   4. Recent event log / memory
 *   5. Trust scores for nearby players/bots
 *   6. Recent documents (journal, plans)
 *   7. Available actions list
 *   8. Response format instructions
 */

/**
 * @typedef {object} PromptContext
 * @property {import('../personality/persona').PersonaData} persona
 * @property {string}   keganPrompt     — formatted Kegan level text
 * @property {string}   meaningContext   — adapter-provided game meaning
 * @property {object}   perception      — current PerceptionState
 * @property {object[]} recentEvents    — from event-log ring buffer
 * @property {object}   trustScores     — { playerName: score }
 * @property {import('../documents/document')[]} documents — recent docs
 * @property {string[]} availableActions — action names the adapter supports
 */

/**
 * Build the full prompt string for the decision LLM call.
 *
 * @param {PromptContext} ctx — all the pieces needed for the prompt
 * @returns {string} — the assembled prompt
 */
function buildPrompt(ctx) {
  // TODO: assemble system prompt + user prompt from context pieces
  // TODO: include response format instructions (JSON with action, speech, thought, etc.)
  throw new Error('buildPrompt() not implemented');
}

/**
 * Build just the system prompt portion (persona + kegan + meaning).
 *
 * @param {PromptContext} ctx
 * @returns {string}
 */
function buildSystemPrompt(ctx) {
  // TODO: combine persona identity, kegan description, meaning context
  throw new Error('buildSystemPrompt() not implemented');
}

module.exports = { buildPrompt, buildSystemPrompt };
