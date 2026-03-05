const fs = require('fs');
const path = require('path');

/**
 * Logger — conversation log + terminal dashboard.
 *
 * Provides two functions:
 *   1. Persistent file logging (conversation, decisions, errors)
 *   2. Live terminal dashboard showing bot status at a glance
 */

class Logger {
  /**
   * @param {object} opts
   * @param {string} opts.logDir   — directory for log files
   * @param {boolean} [opts.dashboard=true] — enable terminal dashboard
   */
  constructor({ logDir, dashboard = true }) {
    this.logDir = logDir;
    this.dashboardEnabled = dashboard;
    /** @type {Map<string, object>} — latest status per bot */
    this.botStatuses = new Map();
  }

  /**
   * Initialise log directory and files.
   * @returns {void}
   */
  init() {
    // TODO: ensure logDir exists
    // TODO: create/open log file streams
    throw new Error('Logger.init() not implemented');
  }

  /**
   * Log a bot's decision and action.
   *
   * @param {string} botName
   * @param {object} decision — parsed decision from LLM
   * @param {object} result   — action execution result
   * @returns {void}
   */
  logDecision(botName, decision, result) {
    // TODO: write timestamped entry to log file
    // TODO: update botStatuses map
    throw new Error('Logger.logDecision() not implemented');
  }

  /**
   * Log a chat message sent or received.
   *
   * @param {string} botName
   * @param {string} direction — 'sent' | 'received'
   * @param {string} message
   * @param {string} [other]   — other party
   * @returns {void}
   */
  logChat(botName, direction, message, other) {
    // TODO: write to conversation log
    throw new Error('Logger.logChat() not implemented');
  }

  /**
   * Log an error.
   *
   * @param {string} botName
   * @param {Error}  error
   * @returns {void}
   */
  logError(botName, error) {
    // TODO: write to error log with stack trace
    throw new Error('Logger.logError() not implemented');
  }

  /**
   * Render the terminal dashboard showing all bot statuses.
   * @returns {void}
   */
  renderDashboard() {
    // TODO: clear terminal, print table of bot statuses
    // TODO: show name, health, action, last decision, uptime
    throw new Error('Logger.renderDashboard() not implemented');
  }

  /**
   * Close all log file handles.
   * @returns {void}
   */
  close() {
    // TODO: close file streams
    throw new Error('Logger.close() not implemented');
  }
}

module.exports = Logger;
