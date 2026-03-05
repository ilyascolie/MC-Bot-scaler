/**
 * EventLog — in-memory ring buffer of recent events per bot.
 *
 * Keeps the last N events (actions taken, messages heard, things observed)
 * so the LLM has short-term memory of what just happened. Not persisted
 * to disk — resets on restart.
 */

/**
 * @typedef {object} Event
 * @property {string} type      — 'action' | 'chat' | 'observation' | 'decision'
 * @property {string} summary   — human-readable one-liner
 * @property {number} timestamp — Date.now() when recorded
 * @property {object} [data]    — optional structured data
 */

class EventLog {
  /**
   * @param {number} [maxSize=100] — max events per bot
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    /** @type {Map<string, Event[]>} */
    this.logs = new Map();
  }

  /**
   * Record an event for a bot.
   *
   * @param {string} botName
   * @param {Event}  event
   * @returns {void}
   */
  push(botName, event) {
    if (!this.logs.has(botName)) this.logs.set(botName, []);
    const buf = this.logs.get(botName);
    buf.push({ ...event, timestamp: event.timestamp ?? Date.now() });
    if (buf.length > this.maxSize) buf.shift();
  }

  /**
   * Get the most recent N events for a bot.
   *
   * @param {string} botName
   * @param {number} [count=20] — how many to return
   * @returns {Event[]} — newest first
   */
  recent(botName, count = 20) {
    const buf = this.logs.get(botName);
    if (!buf || buf.length === 0) return [];
    return buf.slice(-count).reverse();
  }

  /**
   * Clear all events for a bot.
   *
   * @param {string} botName
   * @returns {void}
   */
  clear(botName) {
    this.logs.delete(botName);
  }
}

module.exports = EventLog;
