'use strict';

const MEANING_CONTEXT = {
  time: {
    morning: 'The sun is rising. A good time to gather resources and plan the day.',
    afternoon: 'Midday. Most productive work happens now.',
    sunset: 'The sun is setting. Night brings danger. Consider shelter.',
    night: 'Darkness. Hostile mobs spawn. Stay near shelter or light.',
  },
  health: {
    critical: 'You are badly wounded. Finding food or shelter is urgent.',
    low: 'You are hurt. Be cautious.',
    good: 'You are healthy.',
  },
  hunger: {
    starving: 'You are starving. Find food immediately or you will die.',
    hungry: 'You are getting hungry. Eat soon.',
    full: 'You are well-fed.',
  },
};

function getMeaningContext(perception) {
  const parts = [];
  parts.push(MEANING_CONTEXT.time[perception.timeOfDay] || '');
  if (perception.health <= 5) parts.push(MEANING_CONTEXT.health.critical);
  else if (perception.health <= 10) parts.push(MEANING_CONTEXT.health.low);
  if (perception.food <= 3) parts.push(MEANING_CONTEXT.hunger.starving);
  else if (perception.food <= 8) parts.push(MEANING_CONTEXT.hunger.hungry);
  return parts.filter(Boolean).join(' ');
}

module.exports = { getMeaningContext, MEANING_CONTEXT };
