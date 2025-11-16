-- D1 Database Schema
CREATE TABLE IF NOT EXISTS editors (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_updated_at ON editors(updated_at);