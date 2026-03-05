const crypto = require('crypto');

/**
 * Document — plain data class matching the documents table schema.
 *
 * @typedef {object} DocumentFields
 * @property {string}   [id]         — auto-generated UUID if omitted
 * @property {string}   type         — plan | agreement | norm | role | institution | technology | ability
 * @property {string}   scope        — self | pair | group | village | world
 * @property {string?}  parentId     — FK to parent document
 * @property {string}   body         — natural language content
 * @property {string}   createdBy    — bot id
 * @property {number}   createdAt    — game tick
 * @property {number}   [revision]   — starts at 1
 * @property {boolean}  [alive]      — true = active
 * @property {string[]} [awaiting]   — bot ids who haven't signed yet
 */

const VALID_TYPES  = ['plan', 'agreement', 'norm', 'role', 'institution', 'technology', 'ability'];
const VALID_SCOPES = ['self', 'pair', 'group', 'village', 'world'];

class Document {
  /**
   * @param {DocumentFields} fields
   */
  constructor({ id, type, scope, parentId, body, createdBy, createdAt, revision, alive, awaiting } = {}) {
    this.id        = id ?? crypto.randomUUID();
    this.type      = type;
    this.scope     = scope;
    this.parentId  = parentId ?? null;
    this.body      = body;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.revision  = revision ?? 1;
    this.alive     = alive ?? true;
    this.awaiting  = awaiting ?? [];
  }

  /** Convert to a plain object with snake_case keys for DB insertion. */
  toRow() {
    return {
      id:         this.id,
      type:       this.type,
      scope:      this.scope,
      parent_id:  this.parentId,
      body:       this.body,
      created_by: this.createdBy,
      created_at: this.createdAt,
      revision:   this.revision,
      alive:      this.alive ? 1 : 0,
      awaiting:   this.awaiting.length > 0 ? JSON.stringify(this.awaiting) : null,
    };
  }

  /** Build a Document from a raw SQLite row. */
  static fromRow(row) {
    return new Document({
      id:        row.id,
      type:      row.type,
      scope:     row.scope,
      parentId:  row.parent_id,
      body:      row.body,
      createdBy: row.created_by,
      createdAt: row.created_at,
      revision:  row.revision,
      alive:     row.alive === 1,
      awaiting:  row.awaiting ? JSON.parse(row.awaiting) : [],
    });
  }

  static get VALID_TYPES()  { return VALID_TYPES; }
  static get VALID_SCOPES() { return VALID_SCOPES; }
}

module.exports = Document;
