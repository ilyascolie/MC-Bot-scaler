const fs = require('fs');
const path = require('path');

/**
 * ConversationLogger — writes human-readable narrative log files.
 *
 * One file per game-day: day-001.log, day-002.log, etc.
 * Each decision block reads like a story — this is the primary
 * way you observe the simulation.
 */

class ConversationLogger {
  /**
   * @param {object} opts
   * @param {string} opts.logDir — directory for narrative logs
   */
  constructor({ logDir }) {
    this.logDir = path.join(logDir, 'narrative');
    this._currentDay = -1;
    /** @type {string|null} — current log file path */
    this._currentFile = null;
  }

  /**
   * Ensure log directory exists.
   */
  init() {
    fs.mkdirSync(this.logDir, { recursive: true });
  }

  /**
   * Log a complete decision tick for a bot.
   *
   * @param {object} opts
   * @param {string} opts.botName     — display name
   * @param {object} opts.perception  — game state snapshot
   * @param {object} opts.decision    — parsed LLM decision
   * @param {object} opts.store       — DocumentStore (for trust + docs)
   * @param {string} opts.botId       — bot identifier
   * @param {number} opts.decisionTimeMs — how long the LLM call took
   */
  logTick({ botName, perception, decision, store, botId, decisionTimeMs }) {
    const day = this._extractDay(perception);
    this._ensureStream(day);

    const time = this._formatTime(perception);
    const lines = [];

    // Header
    lines.push(`[Day ${day} ${time}] ${botName.toUpperCase()}${decisionTimeMs != null ? `  (${decisionTimeMs}ms)` : ''}`);

    // Perception summary
    const sees = this._formatSees(perception);
    if (sees) lines.push(`  sees: ${sees}`);

    // Documents summary
    const docs = this._formatDocs(store, botId);
    if (docs) lines.push(`  docs: ${docs}`);

    // Action
    if (decision && decision.action) {
      const params = decision.action.params.length > 0
        ? `(${decision.action.params.join(', ')})`
        : '';
      lines.push(`  action: ${decision.action.ability}${params}`);
    } else {
      lines.push('  action: IDLE');
    }

    // Speech
    if (decision && decision.speech) {
      const target = decision.speech.target ? ` -> ${decision.speech.target}` : '';
      lines.push(`  speech: "${decision.speech.text}"${target}`);
    }

    // Internal thought
    if (decision && decision.internal) {
      // Wrap long thoughts
      const thought = decision.internal;
      if (thought.length > 70) {
        const wrapped = this._wrapText(thought, 62);
        lines.push(`  internal: "${wrapped[0]}`);
        for (let i = 1; i < wrapped.length; i++) {
          lines.push(`            ${wrapped[i]}${i === wrapped.length - 1 ? '"' : ''}`);
        }
      } else {
        lines.push(`  internal: "${thought}"`);
      }
    }

    // Propose
    if (decision && decision.propose) {
      lines.push(`  propose: ${decision.propose.type}/${decision.propose.scope} — ${decision.propose.body}`);
    }

    // Challenge
    if (decision && decision.challenge) {
      lines.push(`  challenge: ${decision.challenge.documentId} — ${decision.challenge.reason}`);
    }

    // Sign / Reject
    if (decision && decision.sign) {
      lines.push(`  sign: ${decision.sign}`);
    }
    if (decision && decision.reject) {
      lines.push(`  reject: ${decision.reject}`);
    }

    // Trust scores
    const trust = this._formatTrust(store, botId);
    if (trust) lines.push(`  trust: ${trust}`);

    lines.push('');

    this._write(lines.join('\n') + '\n');
  }

  /**
   * Log a notable event (death, respawn, violation, etc.)
   *
   * @param {string} message
   * @param {number} [day]
   */
  logEvent(message, day) {
    this._ensureStream(day || this._currentDay);
    const ts = new Date().toISOString().slice(11, 16);
    this._write(`[--- ${ts}] ${message}\n\n`);
  }

  /**
   * Extract game day from perception data.
   * @param {object} perception
   * @returns {number}
   */
  _extractDay(perception) {
    if (!perception) return this._currentDay > 0 ? this._currentDay : 1;
    if (perception.dayCount != null) return perception.dayCount || 1;
    if (perception.dayNumber != null) return perception.dayNumber || 1;
    return this._currentDay > 0 ? this._currentDay : 1;
  }

  /**
   * Format the time of day from perception.
   * @param {object} perception
   * @returns {string}
   */
  _formatTime(perception) {
    if (!perception) return new Date().toISOString().slice(11, 16);

    const tod = perception.timeOfDay;
    if (typeof tod === 'string') return tod;

    // Minecraft ticks: 0=6:00, 6000=noon, 12000=18:00, 18000=midnight
    if (typeof tod === 'number') {
      const hours = Math.floor(((tod + 6000) % 24000) / 1000);
      const mins = Math.floor((((tod + 6000) % 24000) % 1000) / 1000 * 60);
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    return new Date().toISOString().slice(11, 16);
  }

  /**
   * Format what the bot sees into a compact string.
   * @param {object} perception
   * @returns {string}
   */
  _formatSees(perception) {
    if (!perception) return '';
    const parts = [];

    // Nearby entities
    if (perception.nearbyEntities && perception.nearbyEntities.length > 0) {
      const entities = perception.nearbyEntities.slice(0, 5);
      for (const e of entities) {
        if (typeof e === 'string') {
          parts.push(e);
        } else if (e.name) {
          parts.push(`${e.name} (${e.distance}b)`);
        }
      }
    }

    // Notable blocks
    if (perception.nearbyBlocks && perception.nearbyBlocks.length > 0) {
      const blocks = perception.nearbyBlocks.slice(0, 3);
      parts.push(blocks.join(', ') + ' nearby');
    }

    // Health
    const hp = perception.health != null ? perception.health : '?';
    const food = perception.food != null ? perception.food : (perception.hunger != null ? perception.hunger : '?');
    parts.push(`HP ${hp}/20 Food ${food}/20`);

    return parts.join(', ');
  }

  /**
   * Format the bot's document commitments compactly.
   * @param {object} store
   * @param {string} botId
   * @returns {string}
   */
  _formatDocs(store, botId) {
    try {
      const docs = store.getDocumentsForBot(botId);
      if (docs.length === 0) return '';

      const summaries = docs.slice(0, 4).map((d) => {
        const body = d.body.length > 40 ? d.body.slice(0, 40) + '...' : d.body;
        return `${d.type}:"${body}"`;
      });

      const extra = docs.length > 4 ? ` (+${docs.length - 4} more)` : '';
      return summaries.join(', ') + extra;
    } catch {
      return '';
    }
  }

  /**
   * Format trust scores compactly.
   * @param {object} store
   * @param {string} botId
   * @returns {string}
   */
  _formatTrust(store, botId) {
    try {
      const trustMap = store.getTrustMap(botId);
      const entries = Object.entries(trustMap);
      if (entries.length === 0) return '';

      return entries
        .sort((a, b) => b[1] - a[1])
        .map(([name, score]) => {
          const sign = score > 0 ? '+' : '';
          // Capitalize first letter
          const cap = name.charAt(0).toUpperCase() + name.slice(1);
          return `${cap} ${sign}${score}`;
        })
        .join(', ');
    } catch {
      return '';
    }
  }

  /**
   * Word-wrap text to maxLen characters per line.
   * @param {string} text
   * @param {number} maxLen
   * @returns {string[]}
   */
  _wrapText(text, maxLen) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
      if (current.length + word.length + 1 > maxLen && current.length > 0) {
        lines.push(current);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /**
   * Ensure we're pointing at the right day file.
   * @param {number} day
   */
  _ensureStream(day) {
    if (day < 1) day = 1;
    if (day === this._currentDay && this._currentFile) return;

    this._currentDay = day;
    const filename = `day-${String(day).padStart(3, '0')}.log`;
    this._currentFile = path.join(this.logDir, filename);
  }

  /**
   * Append text to the current log file (sync for simplicity — writes are small and infrequent).
   * @param {string} text
   */
  _write(text) {
    if (this._currentFile) {
      fs.appendFileSync(this._currentFile, text);
    }
  }

  /**
   * No-op close (sync writes don't need flushing).
   */
  close() {
    this._currentFile = null;
  }
}

module.exports = ConversationLogger;
