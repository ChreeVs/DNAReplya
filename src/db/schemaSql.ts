export const schemaSql = `
-- DNAReplya Multi-Profile SQLite Database Schema

CREATE TABLE IF NOT EXISTS global_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_ai_provider TEXT DEFAULT 'openai',
  api_key_openai TEXT DEFAULT '',
  api_key_gemini TEXT DEFAULT '',
  api_key_anthropic TEXT DEFAULT '',
  global_telegram_bot_token TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO global_settings (id) VALUES (1);

-- Internal Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- admin, member
  is_approved INTEGER DEFAULT 0, -- 1 = approved, 0 = pending
  approval_token TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#a3e635',
  logo_url TEXT DEFAULT '',
  ai_provider TEXT DEFAULT 'openai',
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  tone_of_voice TEXT DEFAULT 'friendly',
  custom_tone_instructions TEXT DEFAULT '',
  max_reply_length INTEGER DEFAULT 280,
  forbidden_words TEXT DEFAULT '',
  business_knowledge TEXT DEFAULT '',
  auto_pilot_enabled INTEGER DEFAULT 0,
  auto_pilot_min_confidence REAL DEFAULT 0.85,
  auto_like_facebook INTEGER DEFAULT 1,
  telegram_bot_token TEXT DEFAULT '',
  telegram_chat_id TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_handle TEXT NOT NULL,
  external_account_id TEXT DEFAULT '',
  access_token TEXT DEFAULT '',
  refresh_token TEXT DEFAULT '',
  status TEXT DEFAULT 'connected',
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  social_account_id TEXT,
  platform TEXT NOT NULL,
  platform_post_id TEXT DEFAULT '',
  platform_comment_id TEXT DEFAULT '',
  author_username TEXT DEFAULT '',
  author_name TEXT DEFAULT '',
  comment_text TEXT NOT NULL,
  post_snippet TEXT DEFAULT '',
  post_url TEXT DEFAULT '',
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  proposed_reply TEXT DEFAULT '',
  final_reply TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  telegram_message_id INTEGER DEFAULT NULL,
  replied_at DATETIME DEFAULT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS approved_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  comment_id TEXT,
  platform TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  approved_reply TEXT NOT NULL,
  category_tags TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT,
  event_type TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Deleted Comments Blacklist (evita che i commenti eliminati vengano risincronizzati da Meta o TikTok)
CREATE TABLE IF NOT EXISTS deleted_comments (
  platform_comment_id TEXT PRIMARY KEY,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_profile ON social_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_approved_replies_profile ON approved_replies(profile_id);
CREATE INDEX IF NOT EXISTS idx_deleted_comments_id ON deleted_comments(platform_comment_id);
`;
