'use strict';

/**
 * Base class for game adapters. All game-specific code lives in adapters.
 * Core knows nothing about any specific game.
 */
class AdapterInterface {
  /** Connect a bot to the game server. Returns when connected. */
  async connect(persona, serverConfig) { throw new Error('Not implemented'); }

  /** Read game state and return a PerceptionState object. */
  async perceive() { throw new Error('Not implemented'); }

  /** Execute an action parsed from LLM output. */
  async execute(action) { throw new Error('Not implemented'); }

  /** Send a chat message in-game. */
  async speak(text, target) { throw new Error('Not implemented'); }

  /** Get meaning context for prompt building. */
  getMeaningContext() { throw new Error('Not implemented'); }

  /** Disconnect from the game. */
  async disconnect() { throw new Error('Not implemented'); }
}

module.exports = AdapterInterface;
