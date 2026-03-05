const fs = require('fs');
const path = require('path');

const DEFAULT_PERSONAS_DIR = path.resolve(__dirname, '..', '..', '..', 'personas');

/**
 * @typedef {object} PersonaData
 * @property {string} id             — unique identifier (matches filename)
 * @property {string} name           — display name
 * @property {string} backstory      — 2-3 sentence background
 * @property {number} kegan_level    — 1–5
 * @property {number} honesty        — 0.0–1.0
 * @property {number} agreeableness  — 0.0–1.0
 * @property {number} risk_tolerance — 0.0–1.0
 * @property {number} social_drive   — 0.0–1.0
 * @property {number} self_awareness — 0.0–1.0
 */

const REQUIRED_STRING_FIELDS = ['id', 'name', 'backstory'];
const REQUIRED_RANGE_FIELDS = [
  { key: 'honesty',        min: 0, max: 1 },
  { key: 'agreeableness',  min: 0, max: 1 },
  { key: 'risk_tolerance', min: 0, max: 1 },
  { key: 'social_drive',   min: 0, max: 1 },
  { key: 'self_awareness', min: 0, max: 1 },
];
const KEGAN_FIELD = { key: 'kegan_level', min: 1, max: 5 };

/**
 * Validate a parsed persona object. Throws on missing/wrong-type required
 * fields. Logs warnings for out-of-range numeric values and clamps them.
 *
 * @param {object} data — raw parsed JSON
 * @param {string} [source] — filename for error messages
 * @returns {PersonaData}
 */
function validatePersona(data, source = 'unknown') {
  const errors = [];
  const warnings = [];

  // --- required strings ---
  for (const key of REQUIRED_STRING_FIELDS) {
    if (typeof data[key] !== 'string' || data[key].trim() === '') {
      errors.push(`"${key}" must be a non-empty string`);
    }
  }

  // --- kegan_level (integer 1-5) ---
  if (typeof data[KEGAN_FIELD.key] !== 'number' || !Number.isInteger(data[KEGAN_FIELD.key])) {
    errors.push(`"${KEGAN_FIELD.key}" must be an integer`);
  } else if (data[KEGAN_FIELD.key] < KEGAN_FIELD.min || data[KEGAN_FIELD.key] > KEGAN_FIELD.max) {
    warnings.push(`"${KEGAN_FIELD.key}" value ${data[KEGAN_FIELD.key]} outside range ${KEGAN_FIELD.min}–${KEGAN_FIELD.max}, clamping`);
    data[KEGAN_FIELD.key] = Math.max(KEGAN_FIELD.min, Math.min(KEGAN_FIELD.max, data[KEGAN_FIELD.key]));
  }

  // --- 0-1 range fields ---
  for (const { key, min, max } of REQUIRED_RANGE_FIELDS) {
    if (typeof data[key] !== 'number') {
      errors.push(`"${key}" must be a number`);
    } else if (data[key] < min || data[key] > max) {
      warnings.push(`"${key}" value ${data[key]} outside range ${min}–${max}, clamping`);
      data[key] = Math.max(min, Math.min(max, data[key]));
    }
  }

  for (const w of warnings) {
    console.warn(`[persona:${source}] WARNING: ${w}`);
  }
  if (errors.length > 0) {
    throw new Error(`[persona:${source}] Validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return data;
}

/**
 * Load a single persona JSON file.
 *
 * @param {string} personaName — filename without .json (e.g. 'marcus')
 * @param {string} [personasDir]
 * @returns {PersonaData}
 */
function loadPersona(personaName, personasDir = DEFAULT_PERSONAS_DIR) {
  const filePath = path.join(personasDir, `${personaName}.json`);

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Persona file not found: ${filePath}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in persona file ${filePath}: ${err.message}`);
  }

  return validatePersona(data, personaName);
}

/**
 * List available persona names by scanning the personas/ directory.
 *
 * @param {string} [personasDir]
 * @returns {string[]}
 */
function listPersonas(personasDir = DEFAULT_PERSONAS_DIR) {
  const entries = fs.readdirSync(personasDir);
  return entries
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/**
 * Load every persona in the directory. Returns a Map keyed by id.
 *
 * @param {string} [personasDir]
 * @returns {Map<string, PersonaData>}
 */
function loadAllPersonas(personasDir = DEFAULT_PERSONAS_DIR) {
  const names = listPersonas(personasDir);
  const personas = new Map();
  for (const name of names) {
    const persona = loadPersona(name, personasDir);
    personas.set(persona.id, persona);
  }
  return personas;
}

module.exports = { loadPersona, validatePersona, listPersonas, loadAllPersonas };

// --- self-test: node src/core/personality/persona.js ---
if (require.main === module) {
  const all = loadAllPersonas();
  console.log(`\nLoaded ${all.size} personas:\n`);

  // header
  const hdr = [
    'ID'.padEnd(8),
    'Name'.padEnd(8),
    'Kegan'.padEnd(6),
    'Hon'.padEnd(5),
    'Agree'.padEnd(6),
    'Risk'.padEnd(5),
    'Social'.padEnd(7),
    'SelfAw'.padEnd(7),
    'Backstory',
  ].join(' ');
  console.log(hdr);
  console.log('-'.repeat(hdr.length + 20));

  for (const p of all.values()) {
    const row = [
      p.id.padEnd(8),
      p.name.padEnd(8),
      String(p.kegan_level).padEnd(6),
      p.honesty.toFixed(2).padEnd(5),
      p.agreeableness.toFixed(2).padEnd(6),
      p.risk_tolerance.toFixed(2).padEnd(5),
      p.social_drive.toFixed(2).padEnd(7),
      p.self_awareness.toFixed(2).padEnd(7),
      p.backstory.substring(0, 50) + '…',
    ].join(' ');
    console.log(row);
  }

  console.log('\nAll personas valid.');
}
