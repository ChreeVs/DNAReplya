import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: Database.Database = new Database(config.databasePath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// Initialize schema
export function initDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  } else {
    // Fallback for compiled dist or different execution contexts
    const fallbackPath = path.resolve(process.cwd(), 'src', 'db', 'schema.sql');
    if (fs.existsSync(fallbackPath)) {
      const schemaSql = fs.readFileSync(fallbackPath, 'utf-8');
      db.exec(schemaSql);
    }
  }
}

// Interfaces
export interface AppSettings {
  id: number;
  ai_provider: string;
  ai_model: string;
  api_key_openai: string;
  api_key_gemini: string;
  api_key_anthropic: string;
  api_key_groq: string;
  tone_of_voice: string;
  custom_tone_instructions: string;
  max_reply_length: number;
  forbidden_words: string;
  business_knowledge: string;
  auto_pilot_enabled: number;
  auto_pilot_min_confidence: number;
  telegram_bot_token: string;
  telegram_admin_chat_id: string;
  updated_at: string;
}

export interface CommentRecord {
  id: string;
  platform: string;
  platform_post_id: string;
  platform_comment_id: string;
  author_username: string;
  author_name: string;
  comment_text: string;
  post_snippet: string;
  received_at: string;
  proposed_reply: string;
  final_reply: string;
  status: 'pending' | 'approved' | 'modified' | 'rejected' | 'auto_replied';
  telegram_message_id: number | null;
  replied_at: string | null;
}

export interface ApprovedReplyRecord {
  id: number;
  comment_id: string | null;
  platform: string;
  comment_text: string;
  approved_reply: string;
  category_tags: string;
  created_at: string;
}

// Database helper functions
export const dbRepository = {
  getSettings(): AppSettings {
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as AppSettings;
    return row;
  },

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const fields = Object.keys(partial).filter(k => k !== 'id' && k !== 'updated_at');
    if (fields.length === 0) return this.getSettings();

    const setClauses = fields.map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`
      UPDATE settings 
      SET ${setClauses}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `);
    stmt.run(partial);
    return this.getSettings();
  },

  insertComment(comment: Partial<CommentRecord>): CommentRecord {
    const stmt = db.prepare(`
      INSERT INTO comments (
        id, platform, platform_post_id, platform_comment_id,
        author_username, author_name, comment_text, post_snippet,
        proposed_reply, final_reply, status, telegram_message_id
      ) VALUES (
        @id, @platform, @platform_post_id, @platform_comment_id,
        @author_username, @author_name, @comment_text, @post_snippet,
        @proposed_reply, @final_reply, @status, @telegram_message_id
      )
    `);

    stmt.run({
      id: comment.id,
      platform: comment.platform || 'simulator',
      platform_post_id: comment.platform_post_id || '',
      platform_comment_id: comment.platform_comment_id || '',
      author_username: comment.author_username || 'anonymous',
      author_name: comment.author_name || 'Anonymous',
      comment_text: comment.comment_text || '',
      post_snippet: comment.post_snippet || '',
      proposed_reply: comment.proposed_reply || '',
      final_reply: comment.final_reply || '',
      status: comment.status || 'pending',
      telegram_message_id: comment.telegram_message_id || null,
    });

    return db.prepare('SELECT * FROM comments WHERE id = ?').get(comment.id) as CommentRecord;
  },

  updateComment(id: string, updates: Partial<CommentRecord>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;

    const setClauses = fields.map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`UPDATE comments SET ${setClauses} WHERE id = @id`);
    stmt.run({ ...updates, id });
  },

  getCommentById(id: string): CommentRecord | undefined {
    return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as CommentRecord | undefined;
  },

  getRecentComments(limit = 50): CommentRecord[] {
    return db.prepare('SELECT * FROM comments ORDER BY received_at DESC LIMIT ?').all(limit) as CommentRecord[];
  },

  saveApprovedReply(data: { comment_id?: string; platform: string; comment_text: string; approved_reply: string; category_tags?: string }): void {
    const stmt = db.prepare(`
      INSERT INTO approved_replies (comment_id, platform, comment_text, approved_reply, category_tags)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(data.comment_id || null, data.platform, data.comment_text, data.approved_reply, data.category_tags || '');
  },

  getApprovedReplies(limit = 10): ApprovedReplyRecord[] {
    return db.prepare('SELECT * FROM approved_replies ORDER BY created_at DESC LIMIT ?').all(limit) as ApprovedReplyRecord[];
  },

  logAudit(event_type: string, details = ''): void {
    db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run(event_type, details);
  }
};
