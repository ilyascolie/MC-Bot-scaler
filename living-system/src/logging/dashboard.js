/**
 * Dashboard — prints a boxed terminal status every N seconds.
 *
 * Uses simple console output (no TUI libraries).
 * Tracks LLM call stats, recent notable events, and overall system health.
 */

class Dashboard {
  /**
   * @param {object} deps
   * @param {import('../orchestrator/bot-manager')} deps.manager
   * @param {import('../core/documents/store')} deps.store
   * @param {number} [deps.intervalMs=30000]
   */
  constructor({ manager, store, intervalMs = 30000 }) {
    this.manager = manager;
    this.store = store;
    this.intervalMs = intervalMs;

    /** @type {NodeJS.Timeout|null} */
    this._intervalId = null;

    /** LLM call tracking */
    this.llmCalls = 0;
    this.totalLlmTimeMs = 0;

    /** Recent notable events (ring buffer, max 8) */
    this._recentEvents = [];
    this._maxRecent = 8;

    /** System start time */
    this._startTime = Date.now();
  }

  /**
   * Start the dashboard interval.
   */
  start() {
    // Print immediately
    this.render();

    this._intervalId = setInterval(() => {
      this.render();
    }, this.intervalMs);
  }

  /**
   * Stop the dashboard interval.
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Record an LLM call for stats.
   *
   * @param {number} durationMs
   */
  recordLlmCall(durationMs) {
    this.llmCalls++;
    this.totalLlmTimeMs += durationMs;
  }

  /**
   * Add a notable event to the recent list.
   *
   * @param {string} message
   */
  addEvent(message) {
    this._recentEvents.push({
      time: new Date().toISOString().slice(11, 16),
      message,
    });
    if (this._recentEvents.length > this._maxRecent) {
      this._recentEvents.shift();
    }
  }

  /**
   * Render the dashboard to stdout.
   */
  render() {
    const status = this.manager.getStatus();
    const W = 45; // inner width

    // Get game day from any alive bot's perception
    let gameDay = '?';
    let gameTime = '';
    for (const [, entry] of this.manager.bots) {
      if (entry.bot.isAlive() && entry.bot.perceptionCache) {
        const p = entry.bot.perceptionCache;
        if (p.dayCount != null) gameDay = p.dayCount;
        else if (p.dayNumber != null) gameDay = p.dayNumber;
        if (typeof p.timeOfDay === 'string') {
          gameTime = p.timeOfDay;
        } else if (typeof p.timeOfDay === 'number') {
          const h = Math.floor(((p.timeOfDay + 6000) % 24000) / 1000);
          const m = Math.floor((((p.timeOfDay + 6000) % 24000) % 1000) / 1000 * 60);
          gameTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
        break;
      }
    }

    // Uptime
    const uptimeMs = Date.now() - this._startTime;
    const uptimeMin = Math.floor(uptimeMs / 60000);
    const uptimeH = Math.floor(uptimeMin / 60);
    const uptimeStr = uptimeH > 0
      ? `${uptimeH}h ${uptimeMin % 60}m`
      : `${uptimeMin}m`;

    // Document counts
    const docCounts = this._getDocCounts(status);

    // Trust range
    const trustRange = this._getTrustRange(status);

    // LLM stats
    const avgLlm = this.llmCalls > 0
      ? (this.totalLlmTimeMs / this.llmCalls / 1000).toFixed(1)
      : '0.0';

    // Build lines
    const lines = [];

    const titleLine = gameTime
      ? `LIVING SYSTEM  Day ${gameDay}, ${gameTime}`
      : `LIVING SYSTEM  Day ${gameDay}`;
    lines.push(this._padLine(titleLine, W));
    lines.push(null); // separator

    lines.push(this._padLine(`Bots alive:  ${status.alive}/${status.total}    (uptime: ${uptimeStr})`, W));

    // Document summary
    const docParts = [];
    for (const [type, count] of Object.entries(docCounts)) {
      // Capitalize
      docParts.push(`${type.charAt(0).toUpperCase() + type.slice(1)}s: ${count}`);
    }
    if (docParts.length > 0) {
      lines.push(this._padLine(`Documents:   ${docParts[0]}`, W));
      for (let i = 1; i < docParts.length; i++) {
        lines.push(this._padLine(`             ${docParts[i]}`, W));
      }
    } else {
      lines.push(this._padLine('Documents:   (none)', W));
    }

    lines.push(this._padLine(`LLM calls:   ${this.llmCalls} (avg ${avgLlm}s)`, W));

    if (trustRange) {
      lines.push(this._padLine(`Trust range: ${trustRange}`, W));
    }

    // Bot list
    lines.push(this._padLine('', W));
    lines.push(this._padLine('Bots:', W));
    for (const bot of status.bots) {
      const state = bot.alive ? 'OK' : 'DEAD';
      const icon = bot.alive ? ' ' : 'x';
      lines.push(this._padLine(` ${icon} ${bot.name} (K${bot.kegan}) ${state}`, W));
    }

    // Recent events
    if (this._recentEvents.length > 0) {
      lines.push(this._padLine('', W));
      lines.push(this._padLine('Recent:', W));
      // Show last 5
      const recent = this._recentEvents.slice(-5);
      for (const evt of recent) {
        const msg = evt.message.length > W - 8
          ? evt.message.slice(0, W - 11) + '...'
          : evt.message;
        lines.push(this._padLine(` ${evt.time} ${msg}`, W));
      }
    }

    // Render box
    const topBorder = '\u250C' + '\u2500'.repeat(W + 2) + '\u2510';
    const botBorder = '\u2514' + '\u2500'.repeat(W + 2) + '\u2518';
    const sepLine   = '\u251C' + '\u2500'.repeat(W + 2) + '\u2524';

    const boxLines = [topBorder];
    for (const line of lines) {
      if (line === null) {
        boxLines.push(sepLine);
      } else {
        boxLines.push('\u2502 ' + line + ' \u2502');
      }
    }
    boxLines.push(botBorder);

    console.log('\n' + boxLines.join('\n') + '\n');
  }

  /**
   * Pad or truncate a string to exact width.
   * @param {string} text
   * @param {number} width
   * @returns {string}
   */
  _padLine(text, width) {
    if (text.length > width) return text.slice(0, width);
    return text + ' '.repeat(width - text.length);
  }

  /**
   * Get document counts by type across all bots.
   * @param {object} status
   * @returns {Record<string, number>}
   */
  _getDocCounts(status) {
    const counts = {};
    try {
      const seen = new Set();
      for (const bot of status.bots) {
        const docs = this.store.getDocumentsForBot(bot.id);
        for (const doc of docs) {
          if (seen.has(doc.id)) continue;
          seen.add(doc.id);
          counts[doc.type] = (counts[doc.type] || 0) + 1;
        }
      }
    } catch {
      // DB may be closed
    }
    return counts;
  }

  /**
   * Get the min and max trust scores across all bot pairs.
   * @param {object} status
   * @returns {string}
   */
  _getTrustRange(status) {
    try {
      let min = 0;
      let max = 0;
      for (const bot of status.bots) {
        const trustMap = this.store.getTrustMap(bot.id);
        for (const score of Object.values(trustMap)) {
          if (score < min) min = score;
          if (score > max) max = score;
        }
      }
      if (min === 0 && max === 0) return '';
      return `${min} to +${max}`;
    } catch {
      return '';
    }
  }
}

module.exports = Dashboard;
