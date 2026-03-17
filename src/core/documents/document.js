'use strict';

const crypto = require('crypto');

class Document {
  constructor({ id, type, scope, parent_id, body, created_by, created_at, revision, alive, awaiting }) {
    this.id = id || crypto.randomUUID();
    this.type = type;
    this.scope = scope;
    this.parent_id = parent_id || null;
    this.body = body;
    this.created_by = created_by;
    this.created_at = created_at || Date.now();
    this.revision = revision || 1;
    this.alive = alive !== undefined ? alive : 1;
    this.awaiting = awaiting || '[]';
  }
}

module.exports = Document;
