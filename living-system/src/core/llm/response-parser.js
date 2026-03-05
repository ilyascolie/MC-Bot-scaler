/**
 * ResponseParser — parses raw LLM output into structured decision fields.
 *
 * The LLM is prompted to return JSON with specific fields. This module
 * extracts and validates that structure, falling back to safe defaults
 * when the model produces malformed output.
 *
 * @typedef {object} ParsedDecision
 * @property {string}      action      — action name to execute (e.g. 'mine', 'follow', 'idle')
 * @property {object}      params      — action parameters
 * @property {string|null}  speech     — message to say aloud (null = stay silent)
 * @property {string|null}  whisper    — private message (null = none)
 * @property {string|null}  whisperTarget — who to whisper to
 * @property {string}       thought    — internal reasoning (logged, not spoken)
 * @property {string|null}  journalEntry — optional journal text to persist
 */

/**
 * Parse the raw text from the LLM into a structured ParsedDecision.
 *
 * @param {string} rawText — the LLM's response text
 * @returns {ParsedDecision}
 */
function parseResponse(rawText) {
  // TODO: try JSON.parse first
  // TODO: fallback: regex extraction for each field
  // TODO: validate action is a known action name
  // TODO: return safe defaults for missing fields
  throw new Error('parseResponse() not implemented');
}

/**
 * Validate that a parsed decision has the minimum required fields.
 *
 * @param {ParsedDecision} decision
 * @returns {boolean}
 */
function isValid(decision) {
  // TODO: check action is a non-empty string, thought is present
  throw new Error('isValid() not implemented');
}

module.exports = { parseResponse, isValid };
