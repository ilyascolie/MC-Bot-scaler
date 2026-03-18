'use strict';
const fs = require('fs');
const path = require('path');
const settings = require('../../../config/settings');

const REQUIRED_FIELDS = ['id', 'name', 'kegan_level', 'honesty', 'agreeableness', 'risk_tolerance', 'social_drive', 'self_awareness', 'backstory'];
const FLOAT_FIELDS = ['honesty', 'agreeableness', 'risk_tolerance', 'social_drive', 'self_awareness'];

function validatePersona(data) {
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined) throw new Error(`Missing required field: ${field}`);
  }
  if (typeof data.id !== 'string') throw new Error('id must be a string');
  if (typeof data.name !== 'string') throw new Error('name must be a string');
  if (typeof data.backstory !== 'string') throw new Error('backstory must be a string');
  if (!Number.isInteger(data.kegan_level) || data.kegan_level < 1 || data.kegan_level > 5) {
    throw new Error('kegan_level must be integer 1-5');
  }
  for (const f of FLOAT_FIELDS) {
    if (typeof data[f] !== 'number') throw new Error(`${f} must be a number`);
    if (data[f] < 0 || data[f] > 1) {
      console.warn(`Warning: ${data.id}.${f} = ${data[f]} clamped to [0,1]`);
      data[f] = Math.max(0, Math.min(1, data[f]));
    }
  }
  return data;
}

function loadPersona(name) {
  const filePath = path.join(settings.paths.personas, `${name}.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return validatePersona(JSON.parse(raw));
}

function loadAllPersonas() {
  const dir = settings.paths.personas;
  const personas = new Map();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const name = path.basename(file, '.json');
    const persona = loadPersona(name);
    personas.set(persona.id, persona);
  }
  return personas;
}

function listPersonas() {
  const dir = settings.paths.personas;
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.basename(f, '.json'));
}

module.exports = { loadPersona, loadAllPersonas, listPersonas, validatePersona };
