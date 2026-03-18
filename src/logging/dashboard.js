'use strict';

class Dashboard {
  constructor(botManager) {
    this.botManager = botManager;
    this.llmCalls = 0;
    this.llmTotalMs = 0;
    this.events = [];
    this.maxEvents = 8;
    this.intervalId = null;
  }

  start(intervalMs = 30000) {
    this.intervalId = setInterval(() => this.render(), intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  recordLlmCall(ms) {
    this.llmCalls++;
    this.llmTotalMs += ms;
  }

  addEvent(msg) {
    this.events.push({ msg, time: new Date().toLocaleTimeString() });
    if (this.events.length > this.maxEvents) this.events.shift();
  }

  render() {
    const status = this.botManager.getStatus();
    const avgMs = this.llmCalls > 0 ? Math.round(this.llmTotalMs / this.llmCalls) : 0;

    const lines = [];
    lines.push('╔══════════════════════════════════════════════╗');
    lines.push('║          LIVING SYSTEM DASHBOARD             ║');
    lines.push('╠══════════════════════════════════════════════╣');
    lines.push(`║ Bots: ${status.alive}/${status.total} alive                             ║`.slice(0, 49) + '║');
    lines.push(`║ LLM: ${this.llmCalls} calls, avg ${avgMs}ms                  ║`.slice(0, 49) + '║');
    lines.push('╠══════════════════════════════════════════════╣');

    for (const bot of status.bots) {
      const state = bot.alive ? '●' : '○';
      const line = `║ ${state} ${bot.name} (K${bot.kegan})`;
      lines.push(line.padEnd(49) + '║');
    }

    if (this.events.length > 0) {
      lines.push('╠══════════════════════════════════════════════╣');
      lines.push('║ Recent Events:                               ║');
      for (const evt of this.events.slice(-5)) {
        const line = `║   ${evt.time} ${evt.msg}`;
        lines.push(line.slice(0, 49).padEnd(49) + '║');
      }
    }

    lines.push('╚══════════════════════════════════════════════╝');

    // Clear and redraw
    console.log('\n' + lines.join('\n'));
  }
}

module.exports = Dashboard;
