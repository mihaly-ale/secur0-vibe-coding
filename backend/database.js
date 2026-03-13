/**
 * database.js
 * SQLite database initialization and setup using better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/notes.db';
const dbDir = path.dirname(path.resolve(DB_PATH));

// Ensure the data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function getDB() {
  if (!db) {
    db = new Database(path.resolve(DB_PATH), {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    });

    // Performance pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -32000'); // 32MB cache

    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password    TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      content     TEXT    NOT NULL DEFAULT '',
      color       TEXT    NOT NULL DEFAULT '#ffffff',
      pinned      INTEGER NOT NULL DEFAULT 0,
      archived    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Refresh tokens table (for token management)
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      token_hash  TEXT    NOT NULL UNIQUE,
      expires_at  TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_notes_user_id    ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_pinned     ON notes(user_id, pinned);
    CREATE INDEX IF NOT EXISTS idx_notes_archived   ON notes(user_id, archived);
    CREATE INDEX IF NOT EXISTS idx_notes_updated    ON notes(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tokens_user_id   ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_hash      ON refresh_tokens(token_hash);

    -- Auto-update trigger for users
    CREATE TRIGGER IF NOT EXISTS users_updated_at
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

    -- Auto-update trigger for notes
    CREATE TRIGGER IF NOT EXISTS notes_updated_at
      AFTER UPDATE ON notes
      BEGIN
        UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
  `);

  console.log('✅ Database schema initialized');
}

// Clean expired refresh tokens periodically
function cleanExpiredTokens() {
  const db = getDB();
  const stmt = db.prepare(`DELETE FROM refresh_tokens WHERE expires_at < datetime('now')`);
  const result = stmt.run();
  if (result.changes > 0) {
    console.log(`🧹 Cleaned ${result.changes} expired refresh token(s)`);
  }
}

// Run cleanup every hour
setInterval(cleanExpiredTokens, 60 * 60 * 1000);

module.exports = { getDB, cleanExpiredTokens };
