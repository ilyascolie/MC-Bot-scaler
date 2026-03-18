'use strict';

class EventLog {
  constructor(maxSize = 20) {
    this.maxSize = maxSize;
    this.events = [];
  }

  push(event) {
    this.events.push({ ...event, timestamp: Date.now() });
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
  }

  recent(n = 10) {
    return this.events.slice(-n);
  }

  clear() {
    this.events = [];
  }

  get length() {
    return this.events.length;
  }
}

module.exports = EventLog;
