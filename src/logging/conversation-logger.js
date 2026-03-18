'use strict';

const fs = require('fs');
const path = require('path');

class ConversationLogger {
  constructor(logDir) {
    this.logDir = path.join(logDir, 'narrative');
    fs.mkdirSync(this.logDir, { recursive: true });
    this.currentDay = -1;
  }

  _getDayFile(dayCount) {
    const num = String(dayCount || 0).padStart(3, '0');
    return path.join(this.logDir, `day-${num}.log`);
  }

  /**
   * Log a single tick for one bot.
   */
  logTick({ botName, perception, decision, documentTree, trustMap, elapsed, dayCount, timeOfDay }) {
    const day = dayCount || 0;
    const file = this._getDayFile(day);

    const lines = [];
    lines.push(`\n[Day ${day} ${timeOfDay || '?'}] ${botName}  (${elapsed}ms)`);

    // Perception summary
    const entities = (perception?.nearbyEntities || []).map(e => `${e.name} (${e.distance}b)`).join(', ') || 'nobody';
    const blocks = (perception?.nearbyBlocks || []).join(', ') || 'nothing notable';
    const hp = perception ? `HP ${perception.health}/20 Food ${perception.food}/20` : '';
    lines.push(`  sees: ${entities}, ${blocks} nearby, ${hp}`);

    // Active documents
    if (documentTree && documentTree.trim()) {
      const docs = documentTree.split('\n').slice(0, 3).map(d => d.trim()).join('; ');
      lines.push(`  docs: ${docs}`);
    }

    // Decision
    if (decision?.action) {
      const params = decision.action.params?.length > 0 ? `(${decision.action.params.join(',')})` : '';
      lines.push(`  action: ${decision.action.ability}${params}`);
    }
    if (decision?.speech) {
      const target = decision.speech.target ? ` -> ${decision.speech.target}` : '';
      lines.push(`  speech: "${decision.speech.text}"${target}`);
    }
    if (decision?.internal) {
      // Word-wrap long thoughts with proper indentation
      const wrapped = this._wordWrap(decision.internal, 60);
      lines.push(`  internal: "${wrapped[0]}"`);
      for (let i = 1; i < wrapped.length; i++) {
        lines.push(`             ${wrapped[i]}`);
      }
    }
    if (decision?.propose) {
      lines.push(`  propose: [${decision.propose.type}] ${decision.propose.body}`);
    }
    if (decision?.sign) lines.push(`  sign: ${decision.sign}`);
    if (decision?.reject) lines.push(`  reject: ${decision.reject}`);
    if (decision?.challenge) lines.push(`  challenge: ${decision.challenge.documentId}`);

    // Trust
    if (trustMap && Object.keys(trustMap).length > 0) {
      const trustStr = Object.entries(trustMap)
        .sort((a, b) => b[1] - a[1])
        .map(([n, s]) => `${n} ${s > 0 ? '+' : ''}${s}`)
        .join(', ');
      lines.push(`  trust: ${trustStr}`);
    }

    lines.push('');

    // Sync write — small and infrequent
    fs.appendFileSync(file, lines.join('\n'));
  }

  logEvent(msg) {
    const file = this._getDayFile(this.currentDay);
    fs.appendFileSync(file, `\n  *** ${msg} ***\n`);
  }

  _wordWrap(text, maxLen) {
    if (!text || text.length <= maxLen) return [text || ''];
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      if (current.length + word.length + 1 > maxLen) {
        lines.push(current);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  close() {
    // Sync writes, no streams to close
  }
}

module.exports = ConversationLogger;
