'use strict';

const mineflayer = require('mineflayer');

function createBot(persona, serverConfig) {
  return mineflayer.createBot({
    host: serverConfig.host,
    port: serverConfig.port,
    username: persona.name,
    version: serverConfig.version || '1.20.4',
    auth: 'offline',
  });
}

module.exports = { createBot };
