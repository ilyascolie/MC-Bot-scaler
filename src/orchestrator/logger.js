'use strict';

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logDir) {
    this.logDir = logDir;
    fs.mkdirSync(logDir, { recursive: true });

    this.decisionStream = fs.createWriteStream(path.join(logDir, 'decisions.log'), { flags: 'a' });
    this.chatStream = fs.createWriteStream(path.join(logDir, 'chat.log'), { flags: 'a' });
    this.errorStream = fs.createWriteStream(path.join(logDir, 'errors.log'), { flags: 'a' });
  }

  _timestamp() {
    return new Date().toISOString();
  }

  info(msg) {
    const line = `[${this._timestamp()}] INFO: ${msg}\n`;
    this.decisionStream.write(line);
    console.log(msg);
  }

  logDecision(botName, decision) {
    const line = `[${this._timestamp()}] ${botName}: ${JSON.stringify(decision)}\n`;
    this.decisionStream.write(line);
  }

  logChat(sender, message, target) {
    const targetStr = target ? ` -> ${target}` : '';
    const line = `[${this._timestamp()}] ${sender}: "${message}"${targetStr}\n`;
    this.chatStream.write(line);
  }

  logError(msg) {
    const line = `[${this._timestamp()}] ERROR: ${msg}\n`;
    this.errorStream.write(line);
    console.error(`ERROR: ${msg}`);
  }

  close() {
    this.decisionStream.end();
    this.chatStream.end();
    this.errorStream.end();
  }
}

module.exports = Logger;
