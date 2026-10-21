-- DNAReplya Multi-Profile SQLite Database Schema

-- Global Application & BYOK Settings
CREATE TABLE IF NOT EXISTS global_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_ai_provider TEXT DEFAULT 'openai', -- openai, gemini, anthropic
  api_key_openai TEXT DEFAULT '',
  api_key_gemini TEXT DEFAULT '',
  api_key_anthropic TEXT DEFAULT '',
  global_telegram_bot_token TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO global_settings (id) VALUES (1);

-- Client / Brand Profiles (es. "Scarabocchi Saggi")
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#a3e635', -- Lime accent default
  ai_provider TEXT DEFAULT 'openai', -- openai, gemini, anthropic
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  tone_of_voice TEXT DEFAULT 'friendly',
  custom_tone_instructions TEXT DEFAULT '',
  max_reply_length INTEGER DEFAULT 280,
  forbidden_words TEXT DEFAULT '',
  business_knowledge TEXT DEFAULT '',
  auto_pilot_enabled INTEGER DEFAULT 0,
  auto_pilot_min_confidence REAL DEFAULT 0.85,
  telegram_bot_token TEXT DEFAULT '',
  telegram_chat_id TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Connected Social Media Accounts per Profile
CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- instagram, facebook, tiktok, linkedin, x, threads
  account_name TEXT NOT NULL,
  account_handle TEXT NOT NULL,
  external_account_id TEXT DEFAULT '',
  access_token TEXT DEFAULT '',
  refresh_token TEXT DEFAULT '',
  status TEXT DEFAULT 'connected', -- connected, disconnected, error
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Real Social Comments
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
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  proposed_reply TEXT DEFAULT '',
  final_reply TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', -- pending, approved, modified, rejected, auto_replied
  telegram_message_id INTEGER DEFAULT NULL,
  replied_at DATETIME DEFAULT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE SET NULL
);

-- Approved Replies Memory Store (Isolated PER PROFILE for targeted learning)
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

-- Audit / Activity Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT,
  event_type TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_profile ON social_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_approved_replies_profile ON approved_replies(profile_id);
