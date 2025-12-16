CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS editors (
    id TEXT NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (username, id),
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_editors_user ON editors(username);
CREATE INDEX IF NOT EXISTS idx_editors_updated ON editors(updated_at);
CREATE INDEX IF NOT EXISTS idx_editors_composite ON editors(username, id);

-- Auto-create "pub" user for public editors
INSERT OR IGNORE INTO users (username, password_hash, created_at)
VALUES ('pub', 'pub', 0);