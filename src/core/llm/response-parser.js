'use strict';

function parseResponse(text) {
  if (!text || typeof text !== 'string') {
    return { action: null, speech: null, internal: null, propose: null, challenge: null, sign: null, reject: null };
  }

  const lines = text.split('\n');
  const result = {
    action: null,
    speech: null,
    internal: null,
    propose: null,
    challenge: null,
    sign: null,
    reject: null,
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // action: ABILITY(param1, param2) or action: idle
    if (/^action\s*[:=]\s*/i.test(trimmed)) {
      const val = trimmed.replace(/^action\s*[:=]\s*/i, '').trim();
      const match = val.match(/^(\w+)(?:\(([^)]*)\))?/);
      if (match) {
        result.action = {
          ability: match[1].toUpperCase(),
          params: match[2] ? match[2].split(',').map(s => s.trim()).filter(Boolean) : [],
        };
      }
    }

    // speech: "text" -> target  OR  speech: "text"
    if (/^speech\s*[:=]\s*/i.test(trimmed)) {
      const val = trimmed.replace(/^speech\s*[:=]\s*/i, '').trim();
      // Match with arrow variants: ->, =>, →
      const arrowMatch = val.match(/^"([^"]*)"?\s*(?:->|=>|→)\s*(\w+)/);
      if (arrowMatch) {
        result.speech = { text: arrowMatch[1], target: arrowMatch[2] };
      } else {
        const quoteMatch = val.match(/^"([^"]*)"/);
        if (quoteMatch) {
          result.speech = { text: quoteMatch[1], target: null };
        } else {
          result.speech = { text: val, target: null };
        }
      }
    }

    // internal: "thought text"
    if (/^internal\s*[:=]\s*/i.test(trimmed)) {
      const val = trimmed.replace(/^internal\s*[:=]\s*/i, '').trim();
      result.internal = val.replace(/^["']|["']$/g, '');
    }

    // propose: type | scope | body
    if (/^propose\s*[:=]\s*/i.test(trimmed)) {
      const val = trimmed.replace(/^propose\s*[:=]\s*/i, '').trim();
      const parts = val.split('|').map(s => s.trim());
      if (parts.length >= 3) {
        result.propose = { type: parts[0], scope: parts[1], body: parts.slice(2).join('|').trim() };
      }
    }

    // challenge: docId | reason
    if (/^challenge\s*[:=]\s*/i.test(trimmed)) {
      const val = trimmed.replace(/^challenge\s*[:=]\s*/i, '').trim();
      const parts = val.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        result.challenge = { documentId: parts[0], reason: parts.slice(1).join('|').trim() };
      }
    }

    // sign: docId
    if (/^sign\s*[:=]\s*/i.test(trimmed)) {
      result.sign = trimmed.replace(/^sign\s*[:=]\s*/i, '').trim();
    }

    // reject: docId
    if (/^reject\s*[:=]\s*/i.test(trimmed)) {
      result.reject = trimmed.replace(/^reject\s*[:=]\s*/i, '').trim();
    }
  }

  return result;
}

function isValid(parsed) {
  return !!(parsed.action || parsed.speech || parsed.propose || parsed.challenge || parsed.sign || parsed.reject);
}

module.exports = { parseResponse, isValid };
