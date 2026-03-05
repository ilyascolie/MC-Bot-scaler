/**
 * ResponseParser — parses raw LLM output into a structured DecisionResult.
 *
 * Expected LLM response format (all fields optional):
 *   action: ABILITY_NAME(param1, param2)
 *   speech: "What I say out loud" → target_name
 *   internal: "What I actually think"
 *   propose: type | scope | body text
 *   challenge: document_id | reason
 *
 * @typedef {object} DecisionResult
 * @property {{ability: string, params: string[]}|null} action
 * @property {{text: string, target: string|null}|null}  speech
 * @property {string|null}                               internal
 * @property {{type: string, scope: string, body: string}|null} propose
 * @property {{documentId: string, reason: string}|null} challenge
 */

// ── field extractors ────────────────────────────────────────

/**
 * Extract a field value from a line starting with `label:`.
 * Returns the trimmed text after the colon, or null if not found.
 * @param {string} text
 * @param {string} label — e.g. 'action', 'speech'
 * @returns {string|null}
 */
function extractField(text, label) {
  const re = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'im');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Parse `ABILITY_NAME(param1, param2)` into structured form.
 * Also handles bare ability names without parentheses.
 * @param {string} raw
 * @returns {{ability: string, params: string[]}}
 */
function parseAction(raw) {
  const m = raw.match(/^(\w+)\(([^)]*)\)$/);
  if (m) {
    const params = m[2]
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return { ability: m[1], params };
  }
  // Bare name — no parens
  const bare = raw.match(/^(\w+)$/);
  if (bare) return { ability: bare[1], params: [] };
  // Fallback: treat entire string as ability name
  return { ability: raw.replace(/[^a-zA-Z0-9_]/g, ''), params: [] };
}

/**
 * Parse `"text" → target` or `"text"` (no target).
 * Tolerates missing quotes and various arrow styles (→, ->, =>).
 * @param {string} raw
 * @returns {{text: string, target: string|null}}
 */
function parseSpeech(raw) {
  // Try: "text" → target
  const withTarget = raw.match(
    /^"?([^"]*)"?\s*(?:→|->|=>)\s*(.+)$/
  );
  if (withTarget) {
    return { text: withTarget[1].trim(), target: withTarget[2].trim() };
  }
  // Just quoted or unquoted text
  const stripped = raw.replace(/^"|"$/g, '').trim();
  return { text: stripped, target: null };
}

/**
 * Parse `type | scope | body text`.
 * @param {string} raw
 * @returns {{type: string, scope: string, body: string}|null}
 */
function parsePropose(raw) {
  const parts = raw.split('|').map((s) => s.trim());
  if (parts.length < 3) return null;
  return { type: parts[0], scope: parts[1], body: parts.slice(2).join('|').trim() };
}

/**
 * Parse `document_id | reason`.
 * @param {string} raw
 * @returns {{documentId: string, reason: string}|null}
 */
function parseChallenge(raw) {
  const parts = raw.split('|').map((s) => s.trim());
  if (parts.length < 2) return null;
  return { documentId: parts[0], reason: parts.slice(1).join('|').trim() };
}

// ── public API ──────────────────────────────────────────────

/**
 * Parse the raw LLM text into a DecisionResult.
 * Every field is null if absent from the response.
 *
 * @param {string} rawText
 * @returns {DecisionResult}
 */
function parseResponse(rawText) {
  const actionRaw    = extractField(rawText, 'action');
  const speechRaw    = extractField(rawText, 'speech');
  const internalRaw  = extractField(rawText, 'internal');
  const proposeRaw   = extractField(rawText, 'propose');
  const challengeRaw = extractField(rawText, 'challenge');

  return {
    action:    actionRaw    ? parseAction(actionRaw)      : null,
    speech:    speechRaw    ? parseSpeech(speechRaw)       : null,
    internal:  internalRaw  ? internalRaw.replace(/^"|"$/g, '').trim() : null,
    propose:   proposeRaw   ? parsePropose(proposeRaw)     : null,
    challenge: challengeRaw ? parseChallenge(challengeRaw) : null,
  };
}

/**
 * Check that a DecisionResult has at least one actionable field.
 * @param {DecisionResult} decision
 * @returns {boolean}
 */
function isValid(decision) {
  return !!(decision.action || decision.speech || decision.propose || decision.challenge);
}

module.exports = { parseResponse, isValid };
