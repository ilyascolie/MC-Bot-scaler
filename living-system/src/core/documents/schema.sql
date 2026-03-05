-- living-system document storage schema
-- Used by store.js via better-sqlite3

CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_name    TEXT    NOT NULL,
  doc_type    TEXT    NOT NULL,   -- e.g. 'journal', 'note', 'plan', 'letter'
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  metadata    TEXT,               -- JSON blob for arbitrary key/value pairs
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_bot     ON documents(bot_name);
CREATE INDEX IF NOT EXISTS idx_documents_type    ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
