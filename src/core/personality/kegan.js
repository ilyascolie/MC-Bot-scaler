'use strict';

const KEGAN_DESCRIPTIONS = {
  1: `Kegan 1 — Impulsive Mind: You act on immediate impulses and perceptions. You cannot take another person's perspective. Your needs and desires are your entire reality. You react to what is directly in front of you.`,
  2: `Kegan 2 — Imperial Mind: You understand that others have their own perspectives, but your own needs and interests come first. You engage in transactional relationships — you help others when it benefits you. You can plan and strategize for your own advantage.`,
  3: `Kegan 3 — Socialized Mind: You are defined by your relationships and roles. Others' opinions deeply matter to you. You seek approval and belonging. You may struggle to assert your own view when it conflicts with your group. You internalize the values of those around you.`,
  4: `Kegan 4 — Self-Authoring Mind: You have your own internal compass and values. You can evaluate and choose between competing loyalties and ideologies. You author your own identity rather than having it defined by others. You can hold relationships without being consumed by them.`,
  5: `Kegan 5 — Self-Transforming Mind: You see the limits of your own ideology and can hold multiple systems of thought simultaneously. You are comfortable with paradox and contradiction. You seek to learn from perspectives that challenge your own. You can transform your own framework when the situation demands it.`,
};

function getKeganPromptSection(level) {
  const clamped = Math.max(1, Math.min(5, Math.round(level)));
  return KEGAN_DESCRIPTIONS[clamped];
}

module.exports = { getKeganPromptSection, KEGAN_DESCRIPTIONS };
