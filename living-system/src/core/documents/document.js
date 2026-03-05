/**
 * Document — plain data class representing a stored document.
 *
 * Documents are the written artefacts that bots produce: journal entries,
 * plans, letters to other bots, observations, etc. They are persisted in
 * SQLite via store.js.
 */
class Document {
  /**
   * @param {object} fields
   * @param {number}  [fields.id]        — auto-assigned by DB
   * @param {string}  fields.botName     — owning bot's name
   * @param {string}  fields.docType     — category (journal, note, plan …)
   * @param {string}  fields.title       — short title
   * @param {string}  fields.body        — full text content
   * @param {object}  [fields.metadata]  — arbitrary key/value pairs
   * @param {string}  [fields.createdAt] — ISO timestamp
   * @param {string}  [fields.updatedAt] — ISO timestamp
   */
  constructor({ id, botName, docType, title, body, metadata, createdAt, updatedAt } = {}) {
    this.id = id ?? null;
    this.botName = botName;
    this.docType = docType;
    this.title = title;
    this.body = body;
    this.metadata = metadata ?? {};
    this.createdAt = createdAt ?? null;
    this.updatedAt = updatedAt ?? null;
  }

  /**
   * Serialise to a plain object suitable for DB insertion.
   * @returns {object}
   */
  toRow() {
    // TODO: implement serialisation (camelCase → snake_case, JSON.stringify metadata)
    throw new Error('Document.toRow() not implemented');
  }

  /**
   * Create a Document from a database row.
   * @param {object} row — raw SQLite row
   * @returns {Document}
   */
  static fromRow(row) {
    // TODO: implement deserialisation (snake_case → camelCase, JSON.parse metadata)
    throw new Error('Document.fromRow() not implemented');
  }
}

module.exports = Document;
