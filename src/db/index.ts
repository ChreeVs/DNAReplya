import { createClient, Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { schemaSql } from './schemaSql.js';

// Resolve database connection
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

let clientUrl: string;
if (tursoUrl) {
  clientUrl = tursoUrl;
  console.log('⚡ [Database] Connessione a Turso Cloud Database:', tursoUrl);
} else {
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  clientUrl = 'file:' + path.resolve(config.databasePath);
  console.log('💾 [Database] Connessione a SQLite Locale:', clientUrl);
}

export const db: Client = createClient({
  url: clientUrl,
  authToken: tursoAuthToken,
});

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

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'member';
  is_approved: number;
  approval_token: string;
  created_at: string;
  approved_at: string | null;
}

export interface ProfileRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  logo_url: string;
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
  post_url?: string;
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

// Initialize database schema and default profile
export async function initDatabase(): Promise<void> {
  await db.executeMultiple(schemaSql);

  // Migration: ensure logo_url column exists in profiles if table already existed
  try {
    await db.execute('ALTER TABLE profiles ADD COLUMN logo_url TEXT DEFAULT ""');
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: ensure deleted_comments blacklist table exists
  try {
    await db.execute('CREATE TABLE IF NOT EXISTS deleted_comments (platform_comment_id TEXT PRIMARY KEY, deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  } catch (e) {
    // Table already exists, ignore
  }

  // Migration: ensure post_url column exists in comments
  try {
    await db.execute('ALTER TABLE comments ADD COLUMN post_url TEXT DEFAULT ""');
  } catch (e) {
    // Column already exists, ignore
  }

  // Ensure default profile "Scarabocchi Saggi" exists
  const existing = await db.execute('SELECT COUNT(*) as count FROM profiles');
  const count = Number(existing.rows[0]?.count || 0);

  if (count === 0) {
    const defaultProfileId = 'prof_scarabocchi_saggi';
    await db.execute({
      sql: `
        INSERT INTO profiles (
          id, name, slug, description, color, logo_url,
          ai_provider, ai_model, tone_of_voice,
          custom_tone_instructions, max_reply_length,
          forbidden_words, business_knowledge,
          auto_pilot_enabled
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?
        )
      `,
      args: [
        defaultProfileId,
        'Scarabocchi Saggi',
        'scarabocchi-saggi',
        'Profilo Cliente Principale',
        '#a3e635',
        '',
        'openai',
        'gpt-4o-mini',
        'friendly',
        '',
        280,
        '',
        '',
        0,
      ],
    });
  }
}

// Database helper functions (Async for Turso / Local LibSQL)
export const dbRepository = {
  // Users & Auth
  async createUser(data: {
    email: string;
    name: string;
    password_hash: string;
    salt: string;
    role?: 'admin' | 'member';
    is_approved?: number;
    approval_token?: string;
  }): Promise<UserRecord> {
    const id = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await db.execute({
      sql: `
        INSERT INTO users (id, email, name, password_hash, salt, role, is_approved, approval_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        data.email.toLowerCase().trim(),
        data.name.trim(),
        data.password_hash,
        data.salt,
        data.role || 'member',
        data.is_approved || 0,
        data.approval_token || '',
      ],
    });

    const user = await this.getUserById(id);
    return user!;
  },

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(email) = ?',
      args: [email.toLowerCase().trim()],
    });
    return res.rows[0] as unknown as UserRecord | undefined;
  },

  async getUserById(id: string): Promise<UserRecord | undefined> {
    const res = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
    return res.rows[0] as unknown as UserRecord | undefined;
  },

  async getUserByApprovalToken(token: string): Promise<UserRecord | undefined> {
    const res = await db.execute({ sql: 'SELECT * FROM users WHERE approval_token = ?', args: [token] });
    return res.rows[0] as unknown as UserRecord | undefined;
  },

  async approveUser(id: string): Promise<UserRecord | undefined> {
    await db.execute({
      sql: 'UPDATE users SET is_approved = 1, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [id],
    });
    return this.getUserById(id);
  },

  async rejectUser(id: string): Promise<void> {
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
  },

  async getPendingUsers(): Promise<UserRecord[]> {
    const res = await db.execute('SELECT * FROM users WHERE is_approved = 0 ORDER BY created_at DESC');
    return res.rows as unknown as UserRecord[];
  },

  async getAllUsers(): Promise<UserRecord[]> {
    const res = await db.execute('SELECT id, email, name, role, is_approved, created_at, approved_at FROM users ORDER BY created_at DESC');
    return res.rows as unknown as UserRecord[];
  },

  // Global Settings
  async getGlobalSettings(): Promise<GlobalSettings> {
    const res = await db.execute('SELECT * FROM global_settings WHERE id = 1');
    return (res.rows[0] as unknown as GlobalSettings) || {
      id: 1,
      default_ai_provider: 'openai',
      api_key_openai: '',
      api_key_gemini: '',
      api_key_anthropic: '',
      global_telegram_bot_token: '',
      updated_at: new Date().toISOString(),
    };
  },

  async updateGlobalSettings(partial: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const fields = Object.keys(partial).filter(k => k !== 'id' && k !== 'updated_at');
    if (fields.length > 0) {
      const setClauses = fields.map(k => `${k} = ?`).join(', ');
      const values = fields.map(k => (partial as any)[k]);
      await db.execute({
        sql: `UPDATE global_settings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        args: values,
      });
    }
    return this.getGlobalSettings();
  },

  // Profiles
  async getAllProfiles(): Promise<ProfileRecord[]> {
    const res = await db.execute('SELECT * FROM profiles ORDER BY created_at ASC');
    return res.rows as unknown as ProfileRecord[];
  },

  async getProfileById(id: string): Promise<ProfileRecord | undefined> {
    const res = await db.execute({ sql: 'SELECT * FROM profiles WHERE id = ?', args: [id] });
    return res.rows[0] as unknown as ProfileRecord | undefined;
  },

  async createProfile(data: Partial<ProfileRecord> & { name: string }): Promise<ProfileRecord> {
    const id = `prof_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const slug = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + '-' + crypto.randomBytes(2).toString('hex');

    await db.execute({
      sql: `
        INSERT INTO profiles (
          id, name, slug, description, color, logo_url,
          ai_provider, ai_model, tone_of_voice,
          custom_tone_instructions, max_reply_length,
          forbidden_words, business_knowledge,
          auto_pilot_enabled, auto_pilot_min_confidence,
          telegram_bot_token, telegram_chat_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?
        )
      `,
      args: [
        id,
        data.name,
        slug,
        data.description || '',
        data.color || '#a3e635',
        data.logo_url || '',
        data.ai_provider || 'openai',
        data.ai_model || 'gpt-4o-mini',
        data.tone_of_voice || 'friendly',
        data.custom_tone_instructions || '',
        data.max_reply_length || 280,
        data.forbidden_words || '',
        data.business_knowledge || '',
        data.auto_pilot_enabled || 0,
        data.auto_pilot_min_confidence || 0.85,
        data.telegram_bot_token || '',
        data.telegram_chat_id || '',
      ],
    });

    const created = await this.getProfileById(id);
    return created!;
  },

  async updateProfile(id: string, updates: Partial<ProfileRecord>): Promise<ProfileRecord | undefined> {
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    if (fields.length > 0) {
      const setClauses = fields.map(k => `${k} = ?`).join(', ');
      const values = fields.map(k => (updates as any)[k]);
      values.push(id);
      await db.execute({
        sql: `UPDATE profiles SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: values,
      });
    }
    return this.getProfileById(id);
  },

  async deleteProfile(id: string): Promise<void> {
    await db.execute({ sql: 'DELETE FROM profiles WHERE id = ?', args: [id] });
  },

  // Social Accounts
  async getSocialAccountsByProfile(profileId: string): Promise<SocialAccountRecord[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM social_accounts WHERE profile_id = ? ORDER BY created_at ASC',
      args: [profileId],
    });
    return res.rows as unknown as SocialAccountRecord[];
  },

  async createSocialAccount(data: {
    profile_id: string;
    platform: SocialAccountRecord['platform'];
    account_name: string;
    account_handle: string;
    external_account_id?: string;
    access_token?: string;
    notes?: string;
  }): Promise<SocialAccountRecord> {
    const id = `acc_${data.platform}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await db.execute({
      sql: `
        INSERT INTO social_accounts (
          id, profile_id, platform, account_name, account_handle,
          external_account_id, access_token, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?)
      `,
      args: [
        id,
        data.profile_id,
        data.platform,
        data.account_name,
        data.account_handle,
        data.external_account_id || '',
        data.access_token || '',
        data.notes || '',
      ],
    });

    const res = await db.execute({ sql: 'SELECT * FROM social_accounts WHERE id = ?', args: [id] });
    return res.rows[0] as unknown as SocialAccountRecord;
  },

  async upsertSocialAccount(data: {
    profile_id: string;
    platform: SocialAccountRecord['platform'];
    account_name: string;
    account_handle: string;
    external_account_id?: string;
    access_token?: string;
    notes?: string;
  }): Promise<SocialAccountRecord> {
    if (data.external_account_id) {
      const existing = await db.execute({
        sql: 'SELECT * FROM social_accounts WHERE profile_id = ? AND platform = ? AND external_account_id = ?',
        args: [data.profile_id, data.platform, data.external_account_id],
      });
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id as string;
        await db.execute({
          sql: `UPDATE social_accounts SET account_name = ?, account_handle = ?, access_token = ?, status = 'connected', notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [data.account_name, data.account_handle, data.access_token || '', data.notes || '', id],
        });
        const res = await db.execute({ sql: 'SELECT * FROM social_accounts WHERE id = ?', args: [id] });
        return res.rows[0] as unknown as SocialAccountRecord;
      }
    }
    return this.createSocialAccount(data);
  },

  async deleteSocialAccount(id: string): Promise<void> {
    await db.execute({ sql: 'DELETE FROM social_accounts WHERE id = ?', args: [id] });
  },

  async findAccountByPlatformAndExternalId(platform: string, externalId: string): Promise<SocialAccountRecord | undefined> {
    const res = await db.execute({
      sql: 'SELECT * FROM social_accounts WHERE platform = ? AND external_account_id = ?',
      args: [platform, externalId],
    });
    return res.rows[0] as unknown as SocialAccountRecord | undefined;
  },

  // Comments
  async getCommentsByProfile(profileId: string, limit = 50): Promise<CommentRecord[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM comments WHERE profile_id = ? ORDER BY received_at DESC LIMIT ?',
      args: [profileId, limit],
    });
    return res.rows as unknown as CommentRecord[];
  },

  async getCommentById(id: string): Promise<CommentRecord | undefined> {
    const res = await db.execute({ sql: 'SELECT * FROM comments WHERE id = ?', args: [id] });
    return res.rows[0] as unknown as CommentRecord | undefined;
  },

  async findCommentByPlatformCommentId(platformCommentId: string): Promise<CommentRecord | undefined> {
    const res = await db.execute({
      sql: 'SELECT * FROM comments WHERE platform_comment_id = ? LIMIT 1',
      args: [platformCommentId],
    });
    return res.rows[0] as unknown as CommentRecord | undefined;
  },

  async recordDeletedComment(platformCommentId: string): Promise<void> {
    if (!platformCommentId) return;
    try {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO deleted_comments (platform_comment_id) VALUES (?)',
        args: [String(platformCommentId)],
      });
    } catch (e) {
      // ignore
    }
  },

  async isPlatformCommentDeleted(platformCommentId: string): Promise<boolean> {
    if (!platformCommentId) return false;
    try {
      const res = await db.execute({
        sql: 'SELECT 1 FROM deleted_comments WHERE platform_comment_id = ? LIMIT 1',
        args: [String(platformCommentId)],
      });
      return res.rows.length > 0;
    } catch (e) {
      return false;
    }
  },

  async insertComment(comment: Partial<CommentRecord> & { profile_id: string; comment_text: string }): Promise<CommentRecord> {
    // Safeguard: do not re-insert comments previously deleted from the inbox
    if (comment.platform_comment_id && await this.isPlatformCommentDeleted(comment.platform_comment_id)) {
      console.log(`[Database] Inserimento ignorato: il commento ${comment.platform_comment_id} è stato precedentemente eliminato dall'inbox.`);
      const existing = await this.findCommentByPlatformCommentId(comment.platform_comment_id);
      if (existing) return existing;
      return {
        id: comment.id || `comm_ignored`,
        profile_id: comment.profile_id,
        social_account_id: comment.social_account_id || null,
        platform: comment.platform || 'instagram',
        platform_post_id: comment.platform_post_id || '',
        platform_comment_id: comment.platform_comment_id || '',
        author_username: comment.author_username || 'utente_social',
        author_name: comment.author_name || 'Utente Social',
        comment_text: comment.comment_text,
        post_snippet: comment.post_snippet || '',
        post_url: comment.post_url || '',
        received_at: new Date().toISOString(),
        proposed_reply: comment.proposed_reply || '',
        final_reply: comment.final_reply || '',
        status: 'rejected',
        telegram_message_id: null,
        replied_at: null,
      };
    }

    const id = comment.id || `comm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await db.execute({
      sql: `
        INSERT INTO comments (
          id, profile_id, social_account_id, platform, platform_post_id, platform_comment_id,
          author_username, author_name, comment_text, post_snippet, post_url,
          proposed_reply, final_reply, status, telegram_message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        comment.profile_id,
        comment.social_account_id || null,
        comment.platform || 'instagram',
        comment.platform_post_id || '',
        comment.platform_comment_id || '',
        comment.author_username || 'utente_social',
        comment.author_name || 'Utente Social',
        comment.comment_text,
        comment.post_snippet || '',
        comment.post_url || '',
        comment.proposed_reply || '',
        comment.final_reply || '',
        comment.status || 'pending',
        comment.telegram_message_id || null,
      ],
    });

    const created = await this.getCommentById(id);
    return created!;
  },

  async updateComment(id: string, updates: Partial<CommentRecord>): Promise<void> {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;
    const setClauses = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => (updates as any)[k]);
    values.push(id);
    await db.execute({
      sql: `UPDATE comments SET ${setClauses} WHERE id = ?`,
      args: values,
    });
  },

  async deleteComment(id: string): Promise<void> {
    try {
      const comment = await this.getCommentById(id);
      if (comment) {
        if (comment.platform_comment_id) {
          await this.recordDeletedComment(comment.platform_comment_id);
        }
        if (comment.id) {
          await this.recordDeletedComment(comment.id);
        }
      } else {
        await this.recordDeletedComment(id);
      }
    } catch (err) {
      console.error('[Database] Errore registrazione blacklist commenti:', err);
    }

    await db.execute({
      sql: 'DELETE FROM comments WHERE id = ?',
      args: [id],
    });
  },

  // Learning Memory (Few-Shot Store isolated per profile)
  async saveApprovedReply(data: {
    profile_id: string;
    comment_id?: string;
    platform: string;
    comment_text: string;
    approved_reply: string;
    category_tags?: string;
  }): Promise<void> {
    await db.execute({
      sql: `
        INSERT INTO approved_replies (profile_id, comment_id, platform, comment_text, approved_reply, category_tags)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [data.profile_id, data.comment_id || null, data.platform, data.comment_text, data.approved_reply, data.category_tags || ''],
    });
  },

  async getApprovedRepliesByProfile(profileId: string, limit = 10): Promise<ApprovedReplyRecord[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM approved_replies WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?',
      args: [profileId, limit],
    });
    return res.rows as unknown as ApprovedReplyRecord[];
  },

  async deleteApprovedReply(id: string | number): Promise<void> {
    await db.execute({
      sql: 'DELETE FROM approved_replies WHERE id = ?',
      args: [Number(id)],
    });
  },
};
