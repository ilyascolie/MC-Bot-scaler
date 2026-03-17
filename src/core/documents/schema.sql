CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('plan','agreement','norm','role','institution','technology','ability')),
  scope TEXT NOT NULL CHECK(scope IN ('self','pair','group','village','world')),
  parent_id TEXT REFERENCES documents(id),
  body TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  alive INTEGER NOT NULL DEFAULT 1,
  awaiting TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS signatories (
  document_id TEXT NOT NULL REFERENCES documents(id),
  bot_id TEXT NOT NULL,
  signed_at INTEGER NOT NULL,
  PRIMARY KEY (document_id, bot_id)
);

CREATE TABLE IF NOT EXISTS trust_scores (
  from_bot TEXT NOT NULL,
  to_bot TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (from_bot, to_bot)
);

CREATE TABLE IF NOT EXISTS document_dependencies (
  parent_id TEXT NOT NULL REFERENCES documents(id),
  child_id TEXT NOT NULL REFERENCES documents(id),
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_docs_alive ON documents(alive);
CREATE INDEX IF NOT EXISTS idx_signatories_bot ON signatories(bot_id);
CREATE INDEX IF NOT EXISTS idx_trust_from ON trust_scores(from_bot);
