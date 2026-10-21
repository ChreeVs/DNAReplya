-- DNAReplya SQLite Database Schema

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ai_provider TEXT DEFAULT 'openai',
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  api_key_openai TEXT DEFAULT '',
  api_key_gemini TEXT DEFAULT '',
  api_key_anthropic TEXT DEFAULT '',
  api_key_groq TEXT DEFAULT '',
  tone_of_voice TEXT DEFAULT 'friendly',
  custom_tone_instructions TEXT DEFAULT '',
  max_reply_length INTEGER DEFAULT 280,
  forbidden_words TEXT DEFAULT '',
  business_knowledge TEXT DEFAULT '',
  auto_pilot_enabled INTEGER DEFAULT 0,
  auto_pilot_min_confidence REAL DEFAULT 0.85,
  telegram_bot_token TEXT DEFAULT '',
  telegram_admin_chat_id TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default row if not exists
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_post_id TEXT DEFAULT '',
  platform_comment_id TEXT DEFAULT '',
  author_username TEXT DEFAULT '',
  author_name TEXT DEFAULT '',
  comment_text TEXT NOT NULL,
  post_snippet TEXT DEFAULT '',
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  proposed_reply TEXT DEFAULT '',
  final_reply TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', -- pending, approved, modified, rejected, auto_replied
  telegram_message_id INTEGER DEFAULT NULL,
  replied_at DATETIME DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS approved_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT,
  platform TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  approved_reply TEXT NOT NULL,
  category_tags TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_comments_platform ON comments(platform);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_received_at ON comments(received_at);
CREATE INDEX IF NOT EXISTS idx_approved_replies_platform ON approved_replies(platform);
