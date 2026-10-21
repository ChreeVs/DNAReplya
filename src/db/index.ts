import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: Database.Database = new Database(config.databasePath);
db.pragma('journal_mode = WAL');

// Interfaces
export interface GlobalSettings {
  id: number;
  default_ai_provider: string; // openai, gemini, anthropic
  api_key_openai: string;
  api_key_gemini: string;
  api_key_anthropic: string;
  global_telegram_bot_token: string;
  updated_at: string;
}

export interface ProfileRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  ai_provider: string;
  ai_model: string;
  tone_of_voice: string;
  custom_tone_instructions: string;
  max_reply_length: number;
  forbidden_words: string;
  business_knowledge: string;
  auto_pilot_enabled: number;
  auto_pilot_min_confidence: number;
  telegram_bot_token: string;
  telegram_chat_id: string;
  created_at: string;
  updated_at: string;
}

export interface SocialAccountRecord {
  id: string;
  profile_id: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'x' | 'threads';
  account_name: string;
  account_handle: string;
  external_account_id: string;
  access_token: string;
  refresh_token: string;
  status: 'connected' | 'disconnected' | 'error';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CommentRecord {
  id: string;
  profile_id: string;
  social_account_id: string | null;
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
  profile_id: string;
  comment_id: string | null;
  platform: string;
  comment_text: string;
  approved_reply: string;
  category_tags: string;
  created_at: string;
}

import { schemaSql } from './schemaSql.js';

// Initialize database schema and default profile
export function initDatabase() {
  db.exec(schemaSql);

  // Ensure default profile "Scarabocchi Saggi" exists
  const existing = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
  if (existing.count === 0) {
    const defaultProfileId = 'prof_scarabocchi_saggi';
    db.prepare(`
      INSERT INTO profiles (
        id, name, slug, description, color,
        ai_provider, ai_model, tone_of_voice,
        custom_tone_instructions, max_reply_length,
        forbidden_words, business_knowledge,
        auto_pilot_enabled
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?
      )
    `).run(
      defaultProfileId,
      'Scarabocchi Saggi',
      'scarabocchi-saggi',
      'Brand editoriale e contenuti illustrati - Gestione social unificata',
      '#a3e635',
      'openai',
      'gpt-4o-mini',
      'friendly',
      'Tono caloroso, accogliente e creativo. Dare del "tu", usare emoji con discrezione.',
      280,
      'sconto speciale, difettoso, gratuito, colpa nostra',
      '- Spedizioni: 4,90€ con corriere espresso (24/48h), gratuite sopra i 39€.\n- Reso: gratuito entro 14 giorni dalla ricezione.\n- Per collaborazioni scrivere a: info@scarabocchisaggi.it.',
      0
    );

    // Add placeholder connected accounts for Scarabocchi Saggi
    const accStmt = db.prepare(`
      INSERT INTO social_accounts (id, profile_id, platform, account_name, account_handle, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    accStmt.run('acc_ig_1', defaultProfileId, 'instagram', 'Scarabocchi Saggi IG', '@scarabocchi_saggi', 'connected', 'Account Instagram Creator collegato');
    accStmt.run('acc_fb_1', defaultProfileId, 'facebook', 'Scarabocchi Saggi Pagina FB', 'scarabocchi.saggi.official', 'connected', 'Pagina Facebook Ufficiale');
    accStmt.run('acc_tt_1', defaultProfileId, 'tiktok', 'Scarabocchi Saggi TikTok', '@scarabocchisaggi', 'connected', 'TikTok Business Channel');
  }
}

// Database helper functions
export const dbRepository = {
  // Global Settings
  getGlobalSettings(): GlobalSettings {
    return db.prepare('SELECT * FROM global_settings WHERE id = 1').get() as GlobalSettings;
  },

  updateGlobalSettings(partial: Partial<GlobalSettings>): GlobalSettings {
    const fields = Object.keys(partial).filter(k => k !== 'id' && k !== 'updated_at');
    if (fields.length === 0) return this.getGlobalSettings();

    const setClauses = fields.map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE global_settings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(partial);
    return this.getGlobalSettings();
  },

  // Profiles
  getAllProfiles(): ProfileRecord[] {
    return db.prepare('SELECT * FROM profiles ORDER BY created_at ASC').all() as ProfileRecord[];
  },

  getProfileById(id: string): ProfileRecord | undefined {
    return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRecord | undefined;
  },

  getProfileBySlug(slug: string): ProfileRecord | undefined {
    return db.prepare('SELECT * FROM profiles WHERE slug = ?').get(slug) as ProfileRecord | undefined;
  },

  createProfile(data: Partial<ProfileRecord> & { name: string }): ProfileRecord {
    const id = `prof_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const slug = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + '-' + crypto.randomBytes(2).toString('hex');

    db.prepare(`
      INSERT INTO profiles (
        id, name, slug, description, color,
        ai_provider, ai_model, tone_of_voice,
        custom_tone_instructions, max_reply_length,
        forbidden_words, business_knowledge,
        auto_pilot_enabled, auto_pilot_min_confidence,
        telegram_bot_token, telegram_chat_id
      ) VALUES (
        @id, @name, @slug, @description, @color,
        @ai_provider, @ai_model, @tone_of_voice,
        @custom_tone_instructions, @max_reply_length,
        @forbidden_words, @business_knowledge,
        @auto_pilot_enabled, @auto_pilot_min_confidence,
        @telegram_bot_token, @telegram_chat_id
      )
    `).run({
      id,
      name: data.name,
      slug,
      description: data.description || '',
      color: data.color || '#a3e635',
      ai_provider: data.ai_provider || 'openai',
      ai_model: data.ai_model || 'gpt-4o-mini',
      tone_of_voice: data.tone_of_voice || 'friendly',
      custom_tone_instructions: data.custom_tone_instructions || '',
      max_reply_length: data.max_reply_length || 280,
      forbidden_words: data.forbidden_words || '',
      business_knowledge: data.business_knowledge || '',
      auto_pilot_enabled: data.auto_pilot_enabled || 0,
      auto_pilot_min_confidence: data.auto_pilot_min_confidence || 0.85,
      telegram_bot_token: data.telegram_bot_token || '',
      telegram_chat_id: data.telegram_chat_id || '',
    });

    return this.getProfileById(id)!;
  },

  updateProfile(id: string, updates: Partial<ProfileRecord>): ProfileRecord | undefined {
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    if (fields.length > 0) {
      const setClauses = fields.map(k => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE profiles SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run({ ...updates, id });
    }
    return this.getProfileById(id);
  },

  deleteProfile(id: string): void {
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  },

  // Social Accounts
  getSocialAccountsByProfile(profileId: string): SocialAccountRecord[] {
    return db.prepare('SELECT * FROM social_accounts WHERE profile_id = ? ORDER BY created_at ASC').all(profileId) as SocialAccountRecord[];
  },

  createSocialAccount(data: {
    profile_id: string;
    platform: SocialAccountRecord['platform'];
    account_name: string;
    account_handle: string;
    external_account_id?: string;
    access_token?: string;
    notes?: string;
  }): SocialAccountRecord {
    const id = `acc_${data.platform}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.prepare(`
      INSERT INTO social_accounts (
        id, profile_id, platform, account_name, account_handle,
        external_account_id, access_token, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?)
    `).run(
      id,
      data.profile_id,
      data.platform,
      data.account_name,
      data.account_handle,
      data.external_account_id || '',
      data.access_token || '',
      data.notes || ''
    );
    return db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(id) as SocialAccountRecord;
  },

  updateSocialAccount(id: string, updates: Partial<SocialAccountRecord>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    if (fields.length === 0) return;
    const setClauses = fields.map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE social_accounts SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run({ ...updates, id });
  },

  deleteSocialAccount(id: string): void {
    db.prepare('DELETE FROM social_accounts WHERE id = ?').run(id);
  },

  findAccountByPlatformAndExternalId(platform: string, externalId: string): SocialAccountRecord | undefined {
    return db.prepare('SELECT * FROM social_accounts WHERE platform = ? AND external_account_id = ?').get(platform, externalId) as SocialAccountRecord | undefined;
  },

  // Comments
  getCommentsByProfile(profileId: string, limit = 50): CommentRecord[] {
    return db.prepare('SELECT * FROM comments WHERE profile_id = ? ORDER BY received_at DESC LIMIT ?').all(profileId, limit) as CommentRecord[];
  },

  getCommentById(id: string): CommentRecord | undefined {
    return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as CommentRecord | undefined;
  },

  insertComment(comment: Partial<CommentRecord> & { profile_id: string; comment_text: string }): CommentRecord {
    const id = comment.id || `comm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const stmt = db.prepare(`
      INSERT INTO comments (
        id, profile_id, social_account_id, platform, platform_post_id, platform_comment_id,
        author_username, author_name, comment_text, post_snippet,
        proposed_reply, final_reply, status, telegram_message_id
      ) VALUES (
        @id, @profile_id, @social_account_id, @platform, @platform_post_id, @platform_comment_id,
        @author_username, @author_name, @comment_text, @post_snippet,
        @proposed_reply, @final_reply, @status, @telegram_message_id
      )
    `);

    stmt.run({
      id,
      profile_id: comment.profile_id,
      social_account_id: comment.social_account_id || null,
      platform: comment.platform || 'instagram',
      platform_post_id: comment.platform_post_id || '',
      platform_comment_id: comment.platform_comment_id || '',
      author_username: comment.author_username || 'utente_social',
      author_name: comment.author_name || 'Utente Social',
      comment_text: comment.comment_text,
      post_snippet: comment.post_snippet || '',
      proposed_reply: comment.proposed_reply || '',
      final_reply: comment.final_reply || '',
      status: comment.status || 'pending',
      telegram_message_id: comment.telegram_message_id || null,
    });

    return this.getCommentById(id)!;
  },

  updateComment(id: string, updates: Partial<CommentRecord>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;
    const setClauses = fields.map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE comments SET ${setClauses} WHERE id = @id`).run({ ...updates, id });
  },

  // Learning Memory (Few-Shot Store isolated per profile)
  saveApprovedReply(data: {
    profile_id: string;
    comment_id?: string;
    platform: string;
    comment_text: string;
    approved_reply: string;
    category_tags?: string;
  }): void {
    db.prepare(`
      INSERT INTO approved_replies (profile_id, comment_id, platform, comment_text, approved_reply, category_tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.profile_id, data.comment_id || null, data.platform, data.comment_text, data.approved_reply, data.category_tags || '');
  },

  getApprovedRepliesByProfile(profileId: string, limit = 10): ApprovedReplyRecord[] {
    return db.prepare('SELECT * FROM approved_replies WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?').all(profileId, limit) as ApprovedReplyRecord[];
  },
};
