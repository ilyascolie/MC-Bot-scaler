-- living-system document storage schema
-- Used by store.js via better-sqlite3

CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,        -- plan, agreement, norm, role, institution, technology, ability
  scope       TEXT NOT NULL,        -- self, pair, group, village, world
  parent_id   TEXT,                 -- FK to documents.id, nullable
  body        TEXT NOT NULL,        -- natural language content
  created_by  TEXT NOT NULL,        -- bot id
  created_at  INTEGER NOT NULL,     -- game tick
  revision    INTEGER DEFAULT 1,
  alive       INTEGER DEFAULT 1,    -- boolean: 1 = active, 0 = killed
  awaiting    TEXT,                  -- JSON array of bot ids who haven't signed yet

  FOREIGN KEY (parent_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_documents_type       ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_scope      ON documents(scope);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_parent     ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_alive      ON documents(alive);

CREATE TABLE IF NOT EXISTS signatories (
  document_id TEXT NOT NULL,
  bot_id      TEXT NOT NULL,
  signed_at   INTEGER NOT NULL,     -- game tick

  PRIMARY KEY (document_id, bot_id),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS trust_scores (
  from_bot     TEXT NOT NULL,
  to_bot       TEXT NOT NULL,
  score        REAL DEFAULT 0.0,    -- -100 to 100
  last_updated INTEGER,

  PRIMARY KEY (from_bot, to_bot)
);

CREATE TABLE IF NOT EXISTS document_dependencies (
  document_id   TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,

  PRIMARY KEY (document_id, depends_on_id),
  FOREIGN KEY (document_id)   REFERENCES documents(id),
  FOREIGN KEY (depends_on_id) REFERENCES documents(id)
);
