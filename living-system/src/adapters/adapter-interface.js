/**
 * AdapterInterface — contract that all game adapters must implement.
 *
 * NOTHING in core/ references Minecraft (or any other game) directly.
 * The decision loop interacts with the game world exclusively through
 * an adapter that satisfies this interface.
 *
 * To support a new game, create a new adapter directory under
 * src/adapters/<game-name>/ and implement a class that extends this one.
 */
class AdapterInterface {
  /**
   * Connect a persona to the game world and return a bot handle.
   *
   * @param {object} persona — parsed persona JSON (see personas/)
   * @returns {Promise<object>} bot handle (opaque to core/)
   */
  async connect(persona) {
    throw new Error('AdapterInterface.connect() not implemented');
  }

  /**
   * Read the current game state visible to a bot and return it in a
   * game-agnostic PerceptionState format that the decision loop can
   * feed to the LLM prompt.
   *
   * @param {object} bot — bot handle returned by connect()
   * @returns {Promise<PerceptionState>} game-agnostic perception data
   *
   * @typedef {object} PerceptionState
   * @property {string}   botName        — this bot's display name
   * @property {{x:number,y:number,z:number}} position — current location
   * @property {number}   health         — 0–1 normalised
   * @property {number}   hunger         — 0–1 normalised
   * @property {string[]} nearbyEntities — names/types of nearby entities
   * @property {string[]} nearbyPlayers  — usernames of nearby players
   * @property {string[]} inventory      — human-readable item list
   * @property {string[]} recentChat     — last N chat messages
   * @property {object}   [extra]        — adapter-specific extras
   */
  async perceive(bot) {
    throw new Error('AdapterInterface.perceive() not implemented');
  }

  /**
   * Execute a named action in the game world.
   *
   * @param {object} bot    — bot handle
   * @param {object} action — { name: string, params: object }
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async execute(bot, action) {
    throw new Error('AdapterInterface.execute() not implemented');
  }

  /**
   * Send a chat message (optionally whispered to a target).
   *
   * @param {object}  bot     — bot handle
   * @param {string}  message — text to send
   * @param {string?} target  — username to whisper to (null = public)
   * @returns {Promise<void>}
   */
  async speak(bot, message, target = null) {
    throw new Error('AdapterInterface.speak() not implemented');
  }

  /**
   * Return a block of natural-language context that explains what objects,
   * items, and interactions mean in this game. Injected into the LLM prompt
   * so the model understands the world it is acting in.
   *
   * @returns {string} meaning context paragraph(s)
   */
  getMeaningContext() {
    throw new Error('AdapterInterface.getMeaningContext() not implemented');
  }

  /**
   * Gracefully disconnect a bot from the game.
   *
   * @param {object} bot — bot handle
   * @returns {Promise<void>}
   */
  async disconnect(bot) {
    throw new Error('AdapterInterface.disconnect() not implemented');
  }
}

module.exports = AdapterInterface;
