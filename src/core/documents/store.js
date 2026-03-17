'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const Document = require('./document');

const TYPE_ORDER = { institution: 0, norm: 1, role: 2, agreement: 3, technology: 4, ability: 5, plan: 6 };

class DocumentStore {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    this.db.exec(schema);

    this._prepareStatements();
  }

  _prepareStatements() {
    this.stmts = {
      insertDoc: this.db.prepare(`
        INSERT INTO documents (id, type, scope, parent_id, body, created_by, created_at, revision, alive, awaiting)
        VALUES (@id, @type, @scope, @parent_id, @body, @created_by, @created_at, @revision, @alive, @awaiting)
      `),
      insertSignatory: this.db.prepare(`
        INSERT INTO signatories (document_id, bot_id, signed_at) VALUES (?, ?, ?)
      `),
      getDoc: this.db.prepare(`SELECT * FROM documents WHERE id = ?`),
      getAwaiting: this.db.prepare(`SELECT awaiting FROM documents WHERE id = ?`),
      updateAwaiting: this.db.prepare(`UPDATE documents SET awaiting = ? WHERE id = ?`),
      getDocsForBot: this.db.prepare(`
        SELECT d.* FROM documents d
        JOIN signatories s ON s.document_id = d.id
        WHERE s.bot_id = ? AND d.alive = 1
      `),
      getChildren: this.db.prepare(`SELECT * FROM documents WHERE parent_id = ? AND alive = 1`),
      killDoc: this.db.prepare(`UPDATE documents SET alive = 0 WHERE id = ?`),
      getTrust: this.db.prepare(`SELECT score FROM trust_scores WHERE from_bot = ? AND to_bot = ?`),
      upsertTrust: this.db.prepare(`
        INSERT INTO trust_scores (from_bot, to_bot, score, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(from_bot, to_bot) DO UPDATE SET
          score = MIN(100, MAX(-100, trust_scores.score + excluded.score)),
          updated_at = excluded.updated_at
      `),
      getTrustMap: this.db.prepare(`SELECT to_bot, score FROM trust_scores WHERE from_bot = ?`),
      getPending: this.db.prepare(`SELECT * FROM documents WHERE alive = 1`),
      getSignatories: this.db.prepare(`SELECT bot_id FROM signatories WHERE document_id = ?`),
    };
  }

  createDocument(doc) {
    if (!(doc instanceof Document)) {
      doc = new Document(doc);
    }
    this.stmts.insertDoc.run({
      id: doc.id,
      type: doc.type,
      scope: doc.scope,
      parent_id: doc.parent_id,
      body: doc.body,
      created_by: doc.created_by,
      created_at: doc.created_at,
      revision: doc.revision,
      alive: doc.alive,
      awaiting: doc.awaiting,
    });
    // Auto-sign creator
    this.stmts.insertSignatory.run(doc.id, doc.created_by, doc.created_at);
    return doc;
  }

  signDocument(docId, botId, tick) {
    this.stmts.insertSignatory.run(docId, botId, tick);
    this.removeFromAwaiting(docId, botId);
  }

  getDocumentsForBot(botId) {
    const docs = this.stmts.getDocsForBot.all(botId);
    docs.sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));
    return docs;
  }

  getDocumentTree(botId) {
    const docs = this.getDocumentsForBot(botId);
    const roots = docs.filter(d => !d.parent_id);
    const lines = [];

    const walk = (docId, depth) => {
      const doc = docs.find(d => d.id === docId);
      if (!doc) return;
      lines.push(`${'  '.repeat(depth)}[${doc.type}] ${doc.body}`);
      const children = docs.filter(d => d.parent_id === docId);
      children.sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));
      for (const child of children) {
        walk(child.id, depth + 1);
      }
    };

    for (const root of roots) {
      walk(root.id, 0);
    }

    return lines.join('\n');
  }

  proposeDocument(doc) {
    if (!(doc instanceof Document)) {
      doc = new Document(doc);
    }
    return this.createDocument(doc);
  }

  challengeDocument(docId, challengerBotId, reason) {
    const parent = this.stmts.getDoc.get(docId);
    if (!parent) return null;
    const challenge = new Document({
      type: parent.type,
      scope: parent.scope,
      parent_id: docId,
      body: reason,
      created_by: challengerBotId,
    });
    return this.createDocument(challenge);
  }

  killDocument(docId) {
    this.stmts.killDoc.run(docId);
  }

  getTrustScore(fromBot, toBot) {
    const row = this.stmts.getTrust.get(fromBot, toBot);
    return row ? row.score : 0;
  }

  updateTrust(fromBot, toBot, delta, tick) {
    this.stmts.upsertTrust.run(fromBot, toBot, delta, tick);
  }

  getTrustMap(botId) {
    const rows = this.stmts.getTrustMap.all(botId);
    const map = {};
    for (const row of rows) {
      map[row.to_bot] = row.score;
    }
    return map;
  }

  getPendingProposals(botId) {
    const docs = this.stmts.getPending.all();
    return docs.filter(d => {
      const awaiting = JSON.parse(d.awaiting);
      return awaiting.includes(botId);
    });
  }

  getSignatories(docId) {
    const rows = this.stmts.getSignatories.all(docId);
    return rows.map(r => r.bot_id);
  }

  removeFromAwaiting(docId, botId) {
    const doc = this.stmts.getAwaiting.get(docId);
    if (!doc) return;
    const list = JSON.parse(doc.awaiting).filter(id => id !== botId);
    this.stmts.updateAwaiting.run(JSON.stringify(list), docId);
  }

  close() {
    this.db.close();
  }
}

module.exports = DocumentStore;
