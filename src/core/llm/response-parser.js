'use strict';

/**
 * Stub response parser — real implementation provided by another agent.
 */
function parseResponse(raw) {
  const decision = {
    action: null,
    speech: null,
    internal: null,
    propose: null,
    challenge: null,
    sign: null,
    reject: null,
  };

  if (!raw) return decision;

  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // action: ABILITY(params)
    const actionMatch = trimmed.match(/^action:\s*(\w+)(?:\(([^)]*)\))?/i);
    if (actionMatch) {
      decision.action = {
        ability: actionMatch[1],
        params: actionMatch[2] ? actionMatch[2].split(',').map(s => s.trim()) : [],
      };
    }

    // speech: "text" -> target
    const speechMatch = trimmed.match(/^speech:\s*"([^"]+)"(?:\s*->\s*(\w+))?/i);
    if (speechMatch) {
      decision.speech = { text: speechMatch[1], target: speechMatch[2] || null };
    }

    // internal: thought text
    const internalMatch = trimmed.match(/^internal:\s*(.+)/i);
    if (internalMatch) {
      decision.internal = internalMatch[1];
    }

    // propose: type | scope | body
    const proposeMatch = trimmed.match(/^propose:\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+)/i);
    if (proposeMatch) {
      decision.propose = { type: proposeMatch[1], scope: proposeMatch[2], body: proposeMatch[3].trim() };
    }

    // challenge: docId | reason
    const challengeMatch = trimmed.match(/^challenge:\s*([\w-]+)\s*\|\s*(.+)/i);
    if (challengeMatch) {
      decision.challenge = { documentId: challengeMatch[1], reason: challengeMatch[2].trim() };
    }

    // sign: docId
    const signMatch = trimmed.match(/^sign:\s*([\w-]+)/i);
    if (signMatch) {
      decision.sign = signMatch[1];
    }

    // reject: docId
    const rejectMatch = trimmed.match(/^reject:\s*([\w-]+)/i);
    if (rejectMatch) {
      decision.reject = rejectMatch[1];
    }
  }

  return decision;
}

function isValid(decision) {
  return decision && decision.action && decision.action.ability;
}

module.exports = { parseResponse, isValid };
