'use strict';

/**
 * Base adapter interface that all game adapters must implement.
 */
class AdapterInterface {
  async connect(_persona, _serverConfig) {
    throw new Error('connect() not implemented');
  }

  async disconnect() {
    throw new Error('disconnect() not implemented');
  }

  perceive() {
    throw new Error('perceive() not implemented');
  }

  async executeAction(_action) {
    throw new Error('executeAction() not implemented');
  }

  speak(_text, _target) {
    throw new Error('speak() not implemented');
  }
}

module.exports = AdapterInterface;
