CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  access_cipher TEXT NOT NULL,
  refresh_cipher TEXT NOT NULL,
  token_expires_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiration ON sessions(expires_at);
