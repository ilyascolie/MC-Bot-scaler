'use strict';

class EventLog {
  constructor(maxSize = 20) {
    this._maxSize = maxSize;
    this._buffer = [];
  }

  push(entry) {
    this._buffer.push(entry);
    if (this._buffer.length > this._maxSize) {
      this._buffer.shift();
    }
  }

  recent(n) {
    if (n === undefined) return [...this._buffer];
    return this._buffer.slice(-n);
  }

  clear() {
    this._buffer = [];
  }

  get length() {
    return this._buffer.length;
  }
}

module.exports = EventLog;
