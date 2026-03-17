'use strict';

/**
 * Stub prompt builder — real implementation provided by another agent.
 */
function buildPrompt({ persona, perception, documentTree, trustMap, recentEvents, abilities }) {
  const parts = [];
  if (persona) parts.push(`You are ${persona.name}.`);
  if (perception) parts.push(`You see ${JSON.stringify(perception.nearbyEntities || [])}.`);
  if (documentTree) parts.push(`Documents: ${documentTree}`);
  if (trustMap) parts.push(`Trust: ${JSON.stringify(trustMap)}`);
  return parts.join('\n');
}

module.exports = { buildPrompt };
