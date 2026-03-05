const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const Document = require('./document');

/**
 * DocumentStore — SQLite CRUD for documents.
 *
 * Manages the lifecycle of Document records: create, read, update, delete,
 * and query by bot name, doc type, or date range.
 */
class DocumentStore {
  /**
   * @param {string} dbPath — path to the SQLite database file
   */
  constructor(dbPath) {
    /** @type {import('better-sqlite3').Database} */
    this.db = null;
    this.dbPath = dbPath;
  }

  /**
   * Open the database and run schema migrations.
   * @returns {void}
   */
  init() {
    // TODO: open better-sqlite3 connection at this.dbPath
    // TODO: read schema.sql and execute it
    throw new Error('DocumentStore.init() not implemented');
  }

  /**
   * Insert a new document.
   * @param {Document} doc
   * @returns {Document} — the inserted document with id and timestamps
   */
  create(doc) {
    // TODO: INSERT INTO documents …
    throw new Error('DocumentStore.create() not implemented');
  }

  /**
   * Fetch a document by its primary key.
   * @param {number} id
   * @returns {Document|null}
   */
  getById(id) {
    // TODO: SELECT * FROM documents WHERE id = ?
    throw new Error('DocumentStore.getById() not implemented');
  }

  /**
   * List documents for a specific bot, optionally filtered by type.
   * @param {string}  botName
   * @param {string}  [docType] — optional filter
   * @param {number}  [limit=50]
   * @returns {Document[]}
   */
  listByBot(botName, docType, limit = 50) {
    // TODO: SELECT with WHERE bot_name = ? AND (doc_type = ? OR no filter)
    throw new Error('DocumentStore.listByBot() not implemented');
  }

  /**
   * Update an existing document's title, body, and/or metadata.
   * @param {number} id
   * @param {object} fields — partial update fields
   * @returns {Document}
   */
  update(id, fields) {
    // TODO: UPDATE documents SET … WHERE id = ?
    throw new Error('DocumentStore.update() not implemented');
  }

  /**
   * Delete a document by id.
   * @param {number} id
   * @returns {boolean} — true if a row was deleted
   */
  delete(id) {
    // TODO: DELETE FROM documents WHERE id = ?
    throw new Error('DocumentStore.delete() not implemented');
  }

  /**
   * Close the database connection.
   * @returns {void}
   */
  close() {
    // TODO: this.db.close()
    throw new Error('DocumentStore.close() not implemented');
  }
}

module.exports = DocumentStore;
