const fs = require('fs');
const path = require('path');

/**
 * Logger — file-based logging for decisions, chat, and errors.
 *
 * Creates three log files:
 *   - decisions.log — every bot decision each tick
 *   - chat.log      — all speech sent and received
 *   - errors.log    — errors and crashes
 */

class Logger {
  /**
   * @param {object} opts
   * @param {string} opts.logDir — directory for log files
   */
  constructor({ logDir }) {
    this.logDir = logDir;
    this._streams = {};
  }

  /**
   * Initialise log directory and open file streams.
   */
  init() {
    fs.mkdirSync(this.logDir, { recursive: true });

    this._streams.decisions = fs.createWriteStream(
      path.join(this.logDir, 'decisions.log'),
      { flags: 'a' }
    );
    this._streams.chat = fs.createWriteStream(
      path.join(this.logDir, 'chat.log'),
      { flags: 'a' }
    );
    this._streams.errors = fs.createWriteStream(
      path.join(this.logDir, 'errors.log'),
      { flags: 'a' }
    );
  }

  /** @returns {string} */
  _ts() {
    return new Date().toISOString();
  }

  /**
   * Log a bot's decision.
   *
   * @param {string} botName
   * @param {object} decision — parsed decision from LLM
   */
  logDecision(botName, decision) {
    if (!this._streams.decisions) return;
    const action = decision.action
      ? `${decision.action.ability}(${decision.action.params.join(',')})`
      : 'none';
    const speech = decision.speech
      ? `"${decision.speech.text}"${decision.speech.target ? ` -> ${decision.speech.target}` : ''}`
      : 'none';
    const internal = decision.internal || 'none';
    this._streams.decisions.write(
      `[${this._ts()}] ${botName} | action: ${action} | speech: ${speech} | thought: ${internal}\n`
    );
  }

  /**
   * Log a chat message sent or received.
   *
   * @param {string} botName
   * @param {string} direction — 'sent' | 'received'
   * @param {string} message
   * @param {string} [other] — other party
   */
  logChat(botName, direction, message, other) {
    if (!this._streams.chat) return;
    const arrow = direction === 'sent' ? '->' : '<-';
    const party = other ? ` ${other}` : '';
    this._streams.chat.write(
      `[${this._ts()}] ${botName} ${arrow}${party}: ${message}\n`
    );
  }

  /**
   * Log an error.
   *
   * @param {string} botName
   * @param {Error|string} error
   */
  logError(botName, error) {
    if (!this._streams.errors) return;
    const msg = error instanceof Error ? `${error.message}\n${error.stack}` : error;
    this._streams.errors.write(
      `[${this._ts()}] ${botName} | ${msg}\n`
    );
  }

  /**
   * Log a general info message to decisions.log.
   *
   * @param {string} message
   */
  info(message) {
    if (!this._streams.decisions) return;
    this._streams.decisions.write(`[${this._ts()}] INFO | ${message}\n`);
  }

  /**
   * Close all log file handles.
   */
  close() {
    for (const stream of Object.values(this._streams)) {
      if (stream) stream.end();
    }
    this._streams = {};
  }
}

module.exports = Logger;
