const fs = require('fs');
const path = require('path');

/**
 * Persona — loads and validates a persona JSON file.
 *
 * A persona defines a bot's name, personality traits, Kegan developmental
 * level, honesty disposition, goals, speech style, and other behavioural
 * parameters that shape LLM prompt construction.
 *
 * @typedef {object} PersonaData
 * @property {string}   name          — unique bot name
 * @property {number}   keganLevel    — 2–5 (see kegan.js)
 * @property {string}   role          — short role description
 * @property {string[]} traits        — personality adjectives
 * @property {boolean}  honest        — honesty disposition
 * @property {string}   speechStyle   — how the bot talks
 * @property {string[]} goals         — long-term goals
 * @property {string}   backstory     — narrative background
 * @property {object}   [extra]       — extension fields
 */

/**
 * Load a persona JSON file from the personas/ directory.
 *
 * @param {string} personaName — filename without extension (e.g. 'marcus')
 * @param {string} [personasDir] — override directory (default: <project>/personas/)
 * @returns {PersonaData}
 * @throws if file not found or validation fails
 */
function loadPersona(personaName, personasDir) {
  // TODO: resolve path, read JSON, call validatePersona(), return parsed data
  throw new Error('loadPersona() not implemented');
}

/**
 * Validate that a parsed persona object has all required fields and
 * correct types.
 *
 * @param {object} data — raw parsed JSON
 * @returns {PersonaData} — validated persona
 * @throws if validation fails
 */
function validatePersona(data) {
  // TODO: check required keys, types, keganLevel range 2–5
  throw new Error('validatePersona() not implemented');
}

/**
 * List available persona names by scanning the personas/ directory.
 *
 * @param {string} [personasDir]
 * @returns {string[]} — persona names (without .json extension)
 */
function listPersonas(personasDir) {
  // TODO: fs.readdirSync, filter .json, strip extension
  throw new Error('listPersonas() not implemented');
}

module.exports = { loadPersona, validatePersona, listPersonas };
