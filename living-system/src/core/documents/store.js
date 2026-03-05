const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const Document = require('./document');

/**
 * Type ordering for getDocumentsForBot — institutions first, plans last.
 * Lower number = higher priority in results.
 */
const TYPE_ORDER = {
  institution: 0,
  norm:        1,
  role:        2,
  agreement:   3,
  technology:  4,
  ability:     5,
  plan:        6,
};

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
   */
  init() {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);

    this._prepareStatements();
  }

  /** Pre-compile frequently used statements. */
  _prepareStatements() {
    this._insertDoc = this.db.prepare(`
      INSERT INTO documents (id, type, scope, parent_id, body, created_by, created_at, revision, alive, awaiting)
      VALUES (@id, @type, @scope, @parent_id, @body, @created_by, @created_at, @revision, @alive, @awaiting)
    `);

    this._insertSignatory = this.db.prepare(`
      INSERT OR IGNORE INTO signatories (document_id, bot_id, signed_at)
      VALUES (?, ?, ?)
    `);

    this._getDoc = this.db.prepare(`SELECT * FROM documents WHERE id = ?`);

    this._getAliveDocsForBot = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN signatories s ON s.document_id = d.id
      WHERE s.bot_id = ? AND d.alive = 1
    `);

    this._getChildDocs = this.db.prepare(`
      SELECT * FROM documents WHERE parent_id = ? AND alive = 1
    `);

    this._killDoc = this.db.prepare(`UPDATE documents SET alive = 0 WHERE id = ?`);

    this._updateAwaiting = this.db.prepare(`UPDATE documents SET awaiting = ? WHERE id = ?`);

    this._upsertTrust = this.db.prepare(`
      INSERT INTO trust_scores (from_bot, to_bot, score, last_updated)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(from_bot, to_bot)
      DO UPDATE SET score = ?, last_updated = ?
    `);

    this._getTrust = this.db.prepare(`
      SELECT score FROM trust_scores WHERE from_bot = ? AND to_bot = ?
    `);

    this._getTrustMap = this.db.prepare(`
      SELECT to_bot, score FROM trust_scores WHERE from_bot = ?
    `);

    this._insertDep = this.db.prepare(`
      INSERT OR IGNORE INTO document_dependencies (document_id, depends_on_id)
      VALUES (?, ?)
    `);
  }

  // ─── Documents ────────────────────────────────────────────

  /**
   * Create a document and auto-sign the creator.
   *
   * @param {object} doc
   * @param {string} doc.type       — plan | agreement | norm | role | institution | technology | ability
   * @param {string} doc.scope      — self | pair | group | village | world
   * @param {string} doc.body       — content text
   * @param {string} doc.createdBy  — bot id
   * @param {number} doc.createdAt  — game tick
   * @param {string} [doc.parentId] — parent document id
   * @returns {Document}
   */
  createDocument(doc) {
    const d = new Document(doc);
    this._insertDoc.run(d.toRow());
    this._insertSignatory.run(d.id, d.createdBy, d.createdAt);
    return d;
  }

  /**
   * Sign a document. Removes the bot from the awaiting list.
   *
   * @param {string} docId
   * @param {string} botId
   * @param {number} gameTick
   * @returns {boolean} — true if the signature was new
   */
  signDocument(docId, botId, gameTick) {
    const result = this._insertSignatory.run(docId, botId, gameTick);
    if (result.changes === 0) return false;

    // Remove from awaiting list
    const row = this._getDoc.get(docId);
    if (row && row.awaiting) {
      const awaiting = JSON.parse(row.awaiting).filter((id) => id !== botId);
      this._updateAwaiting.run(
        awaiting.length > 0 ? JSON.stringify(awaiting) : null,
        docId
      );
    }
    return true;
  }

  /**
   * Get all alive documents where botId is a signatory, ordered by type
   * priority: institutions → norms → roles → agreements → technology → ability → plans.
   *
   * @param {string} botId
   * @returns {Document[]}
   */
  getDocumentsForBot(botId) {
    const rows = this._getAliveDocsForBot.all(botId);
    return rows
      .map(Document.fromRow)
      .sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));
  }

  /**
   * Walk the document hierarchy for a bot and return concatenated text
   * suitable for prompt injection. Groups by type, shows parent→child
   * relationships with indentation.
   *
   * @param {string} botId
   * @returns {string}
   */
  getDocumentTree(botId) {
    const docs = this.getDocumentsForBot(botId);
    if (docs.length === 0) return '';

    // Build a lookup of children by parent_id
    const childrenOf = new Map();
    const roots = [];
    for (const d of docs) {
      if (d.parentId) {
        if (!childrenOf.has(d.parentId)) childrenOf.set(d.parentId, []);
        childrenOf.get(d.parentId).push(d);
      } else {
        roots.push(d);
      }
    }

    const lines = [];

    function walk(doc, depth) {
      const indent = '  '.repeat(depth);
      const label = `[${doc.type.toUpperCase()}/${doc.scope}]`;
      lines.push(`${indent}${label} ${doc.body}`);
      const children = childrenOf.get(doc.id) || [];
      for (const child of children) {
        walk(child, depth + 1);
      }
    }

    for (const root of roots) {
      walk(root, 0);
    }

    // Any docs whose parent wasn't in this bot's set still get included
    const rendered = new Set(lines.map((_, i) => i));
    const visitedIds = new Set();
    const collectIds = (doc) => {
      visitedIds.add(doc.id);
      for (const child of childrenOf.get(doc.id) || []) collectIds(child);
    };
    for (const root of roots) collectIds(root);

    for (const d of docs) {
      if (!visitedIds.has(d.id)) {
        const label = `[${d.type.toUpperCase()}/${d.scope}]`;
        lines.push(`${label} ${d.body}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Create a document that requires signatures from specific bots.
   * The creator is auto-signed; the rest go into the awaiting list.
   *
   * @param {object} doc — same as createDocument, plus:
   * @param {string[]} doc.awaiting — bot ids who must sign
   * @returns {Document}
   */
  proposeDocument(doc) {
    const awaiting = (doc.awaiting || []).filter((id) => id !== doc.createdBy);
    const d = new Document({ ...doc, awaiting });
    this._insertDoc.run(d.toRow());
    this._insertSignatory.run(d.id, d.createdBy, d.createdAt);
    return d;
  }

  /**
   * Challenge a document — creates a child document of type 'plan' (a
   * challenge record) and optionally kills the original.
   *
   * @param {string} docId       — document being challenged
   * @param {string} challengerId — bot raising the challenge
   * @param {string} reason       — natural language reason
   * @param {number} [gameTick]   — current game tick (default 0)
   */
  challengeDocument(docId, challengerId, reason, gameTick = 0) {
    const original = this._getDoc.get(docId);
    if (!original) throw new Error(`Document not found: ${docId}`);

    this.createDocument({
      type: 'plan',
      scope: original.scope,
      parentId: docId,
      body: `CHALLENGE by ${challengerId}: ${reason}`,
      createdBy: challengerId,
      createdAt: gameTick,
    });
  }

  /**
   * Kill (soft-delete) a document by setting alive = 0.
   *
   * @param {string} docId
   */
  killDocument(docId) {
    this._killDoc.run(docId);
  }

  // ─── Trust ────────────────────────────────────────────────

  /**
   * Get a single trust score. Returns 0 if no record exists.
   *
   * @param {string} fromBot
   * @param {string} toBot
   * @returns {number} — score in range -100..100
   */
  getTrustScore(fromBot, toBot) {
    const row = this._getTrust.get(fromBot, toBot);
    return row ? row.score : 0;
  }

  /**
   * Adjust a trust score by delta, clamped to [-100, 100].
   *
   * @param {string} fromBot
   * @param {string} toBot
   * @param {number} delta
   * @param {number} gameTick
   */
  updateTrust(fromBot, toBot, delta, gameTick) {
    const current = this.getTrustScore(fromBot, toBot);
    const clamped = Math.max(-100, Math.min(100, current + delta));
    this._upsertTrust.run(fromBot, toBot, clamped, gameTick, clamped, gameTick);
  }

  /**
   * Get all trust scores from a bot's perspective.
   *
   * @param {string} botId
   * @returns {Record<string, number>}
   */
  getTrustMap(botId) {
    const rows = this._getTrustMap.all(botId);
    const map = {};
    for (const row of rows) {
      map[row.to_bot] = row.score;
    }
    return map;
  }

  // ─── Dependencies ─────────────────────────────────────────

  /**
   * Record that one document depends on another.
   *
   * @param {string} docId
   * @param {string} dependsOnId
   */
  addDependency(docId, dependsOnId) {
    this._insertDep.run(docId, dependsOnId);
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /** Close the database connection. */
  close() {
    if (this.db) this.db.close();
  }
}

module.exports = DocumentStore;
