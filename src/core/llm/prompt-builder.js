'use strict';

const { getKeganPromptSection } = require('../personality/kegan');

/**
 * Build the full decision prompt for a bot's tick.
 */
function buildPrompt({ persona, perception, documentTree, trustMap, recentEvents, abilities }) {
  const sections = [];

  // Section 1: IDENTITY
  sections.push('=== IDENTITY ===');
  sections.push(`You are ${persona.name}. ${persona.backstory}`);
  sections.push(getKeganPromptSection(persona.kegan_level));

  // Honesty description
  if (persona.honesty >= 0.8) sections.push('You are deeply honest. Your speech closely matches your thoughts.');
  else if (persona.honesty >= 0.5) sections.push('You are moderately honest. You may soften or omit uncomfortable truths.');
  else if (persona.honesty >= 0.3) sections.push('You bend the truth when convenient. Your speech often diverges from your real thoughts.');
  else sections.push('You are deceptive. You routinely say things you don\'t believe to manipulate others.');

  // Agreeableness description
  if (persona.agreeableness >= 0.7) sections.push('You are highly agreeable. You prefer harmony and tend to sign proposals from others.');
  else if (persona.agreeableness >= 0.4) sections.push('You are moderately agreeable. You weigh proposals on their merits.');
  else sections.push('You are disagreeable. You push back on proposals and resist group pressure.');

  sections.push(`Risk tolerance: ${persona.risk_tolerance.toFixed(1)}, Social drive: ${persona.social_drive.toFixed(1)}`);
  sections.push('You are in a Minecraft world. This is your reality.');
  sections.push('');

  // Section 2: PERCEPTION
  sections.push('=== WHAT YOU PERCEIVE ===');
  if (perception) {
    if (perception.nearbyEntities?.length > 0) {
      sections.push('Nearby entities: ' + perception.nearbyEntities.map(e => `${e.name} (${e.type}, ${e.distance}b away)`).join(', '));
    } else {
      sections.push('Nearby entities: none');
    }
    if (perception.nearbyBlocks?.length > 0) {
      sections.push('Notable blocks nearby: ' + perception.nearbyBlocks.join(', '));
    }
    if (perception.inventory?.length > 0) {
      sections.push('Inventory: ' + perception.inventory.map(i => `${i.name} x${i.count}`).join(', '));
    } else {
      sections.push('Inventory: empty');
    }
    sections.push(`Health: ${perception.health}/20, Food: ${perception.food}/20`);
    sections.push(`Time: ${perception.timeOfDay}, Day ${perception.dayCount || '?'}`);
    if (perception.recentChat?.length > 0) {
      sections.push('Recent chat:');
      for (const msg of perception.recentChat) {
        sections.push(`  ${msg.sender}: "${msg.message}"`);
      }
    }
  }
  sections.push('');

  // Section 3: DOCUMENT TREE (social context)
  sections.push('=== YOUR SOCIAL CONTEXT ===');
  if (documentTree && documentTree.trim()) {
    sections.push(documentTree);
  } else {
    sections.push('No active documents, agreements, or social commitments.');
  }
  sections.push('');

  // Section 4: TRUST
  sections.push('=== TRUST ===');
  if (trustMap && Object.keys(trustMap).length > 0) {
    const entries = Object.entries(trustMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => `${name}: ${score > 0 ? '+' : ''}${score}`);
    sections.push(entries.join(', '));
  } else {
    sections.push('No trust scores yet.');
  }
  sections.push('');

  // Section 5: RECENT MEMORY
  sections.push('=== RECENT MEMORY ===');
  if (recentEvents?.length > 0) {
    for (const evt of recentEvents.slice().reverse()) {
      const tickStr = evt.tick !== undefined ? `[tick ${evt.tick}] ` : '';
      sections.push(`  ${tickStr}${evt.type}: ${evt.data || evt.description || JSON.stringify(evt)}`);
    }
  } else {
    sections.push('No recent memories.');
  }
  sections.push('');

  // Section 6: ACTION REQUEST
  sections.push('=== DECIDE YOUR NEXT ACTION ===');
  const abilityList = abilities || [
    'IDLE', 'WANDER', 'GO_TO(x,y,z)', 'FOLLOW(name)', 'FLEE(name)',
    'MINE(block_type)', 'CHOP_TREES', 'EAT', 'BUILD_SHELTER',
    'PLACE(block_type,x,y,z)', 'CRAFT(item)', 'STORE(item)', 'RETRIEVE(item)', 'ATTACK(name)',
  ];
  sections.push('Available actions: ' + abilityList.join(', '));
  sections.push('');
  sections.push('Respond with one or more of these lines (each optional):');
  sections.push('  action: ACTION_NAME(params)');
  sections.push('  speech: "what you say aloud" -> target_name');
  sections.push('  internal: "what you privately think"');
  sections.push('  propose: type | scope | body of proposal');
  sections.push('  challenge: document_id | reason');
  sections.push('  sign: document_id');
  sections.push('  reject: document_id');

  return sections.join('\n');
}

module.exports = { buildPrompt };
