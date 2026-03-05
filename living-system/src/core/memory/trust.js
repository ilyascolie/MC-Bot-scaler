/**
 * TrustTracker — per-bot trust score tracking in SQLite.
 *
 * Each bot maintains trust scores for every other player/bot it has
 * interacted with. Trust changes based on observed behaviour: keeping
 * promises raises trust, betrayal lowers it.
 *
 * Trust scores are fed into the LLM prompt so the bot can make
 * trust-informed decisions.
 */

class TrustTracker {
  /**
   * @param {import('better-sqlite3').Database} db — shared SQLite handle
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Ensure the trust table exists.
   * @returns {void}
   */
  init() {
    // TODO: CREATE TABLE IF NOT EXISTS trust (bot_name, target_name, score, updated_at)
    throw new Error('TrustTracker.init() not implemented');
  }

  /**
   * Get the trust score that `botName` has for `targetName`.
   *
   * @param {string} botName
   * @param {string} targetName
   * @returns {number} — trust score (default 0.5 if no record)
   */
  getScore(botName, targetName) {
    // TODO: SELECT score FROM trust WHERE bot_name = ? AND target_name = ?
    throw new Error('TrustTracker.getScore() not implemented');
  }

  /**
   * Update the trust score, clamped to [0, 1].
   *
   * @param {string} botName
   * @param {string} targetName
   * @param {number} delta — positive or negative adjustment
   * @returns {number} — the new score
   */
  adjustScore(botName, targetName, delta) {
    // TODO: UPSERT trust score, clamp between 0 and 1
    throw new Error('TrustTracker.adjustScore() not implemented');
  }

  /**
   * Get all trust scores for a given bot.
   *
   * @param {string} botName
   * @returns {Record<string, number>} — { targetName: score }
   */
  getAllScores(botName) {
    // TODO: SELECT target_name, score FROM trust WHERE bot_name = ?
    throw new Error('TrustTracker.getAllScores() not implemented');
  }
}

module.exports = TrustTracker;
