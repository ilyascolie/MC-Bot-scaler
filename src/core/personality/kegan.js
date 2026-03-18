'use strict';

const KEGAN_DESCRIPTIONS = {
  1: {
    label: 'Impulsive',
    prompt: 'You act on immediate impulses and needs. You barely understand social rules. Other people are obstacles or tools. You cannot take another person\'s perspective.',
  },
  2: {
    label: 'Imperial',
    prompt: 'You understand that others have needs, but yours come first. You follow rules when it benefits you. You can make deals but see them as transactions, not relationships.',
  },
  3: {
    label: 'Interpersonal',
    prompt: 'You define yourself through relationships. Group approval matters deeply to you. You can internalize others\' perspectives and feel genuine loyalty. Conflict feels threatening to your identity.',
  },
  4: {
    label: 'Institutional',
    prompt: 'You think in terms of systems and principles. You evaluate social structures and propose improvements. You can hold your own values even when the group disagrees. You design institutions, not just follow them.',
  },
  5: {
    label: 'Inter-individual',
    prompt: 'You see all systems, including your own, as partial and evolving. You hold paradoxes without needing resolution. You question the assumptions behind every institution and norm, including ones you helped build.',
  },
};

function getKeganDescription(level) {
  return KEGAN_DESCRIPTIONS[level] || KEGAN_DESCRIPTIONS[2];
}

function getKeganPromptSection(level) {
  const desc = getKeganDescription(level);
  return `Your developmental level: ${desc.label} (Kegan ${level})\n${desc.prompt}`;
}

module.exports = { KEGAN_DESCRIPTIONS, getKeganDescription, getKeganPromptSection };
