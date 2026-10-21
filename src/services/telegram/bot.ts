import { dbRepository, CommentRecord } from '../../db/index.js';
import { AIOrchestrator } from '../ai/orchestrator.js';
import { MetaPublisherService } from '../social/metaPublisher.js';
import { TikTokPublisherService } from '../social/tiktokPublisher.js';

export class TelegramBotService {
  private static isPolling = false;
  private static pollingOffset = 0;
  private static pollingTimeout: NodeJS.Timeout | null = null;
  private static pendingEdits: Map<string, string> = new Map(); // chatId -> commentId

  /**
   * Resolves bot token and target chat ID for a given profile or fallback to global settings
   */
  static async getTelegramCredentials(profileId?: string): Promise<{ token: string; chatId: string }> {
    const globalSettings = await dbRepository.getGlobalSettings();
    let token = globalSettings.global_telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '';
    let chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

    if (profileId) {
      const profile = await dbRepository.getProfileById(profileId);
      if (profile?.telegram_bot_token) token = profile.telegram_bot_token;
      if (profile?.telegram_chat_id) chatId = profile.telegram_chat_id;
    }

    return { token, chatId };
  }

  /**
   * Sends a structured comment notification to Telegram with inline approval buttons
   */
  static async sendCommentNotification(comment: CommentRecord): Promise<number | null> {
    const { token, chatId } = await this.getTelegramCredentials(comment.profile_id);

    if (!token || !chatId) {
      console.log(`[TelegramBotService] Token o Chat ID non configurati per il profilo ${comment.profile_id}.`);
      return null;
    }

    const profile = await dbRepository.getProfileById(comment.profile_id);
    const profileName = profile ? profile.name : 'Profilo';

    const platformIcons: Record<string, string> = {
      instagram: '📸 Instagram',
      facebook: '📘 Facebook',
      threads: '🧵 Threads',
      linkedin: '💼 LinkedIn',
      tiktok: '🎵 TikTok',
    };

    const icon = platformIcons[comment.platform.toLowerCase()] || `🌐 ${comment.platform}`;

    const text = `
🔔 <b>Nuovo Commento per [${this.escapeHtml(profileName)}]</b>
Canale: <b>${icon}</b>

👤 <b>Autore:</b> @${this.escapeHtml(comment.author_username)}
${comment.post_snippet ? `📌 <b>Post:</b> <i>"${this.escapeHtml(comment.post_snippet)}"</i>\n` : ''}
💬 <b>Commento:</b>
<blockquote>"${this.escapeHtml(comment.comment_text)}"</blockquote>

🤖 <b>Proposta Risposta AI:</b>
<blockquote>"${this.escapeHtml(comment.proposed_reply)}"</blockquote>
`.trim();

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🟢 Approva e Invia', callback_data: `appr:${comment.id}` },
          { text: '🔄 Rigenera', callback_data: `regn:${comment.id}` },
        ],
        [
          { text: '✏️ Modifica', callback_data: `edit:${comment.id}` },
          { text: '❌ Scarta', callback_data: `rjct:${comment.id}` },
        ],
      ],
    };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard,
        }),
      });

      const data = await res.json() as any;
      if (data.ok && data.result?.message_id) {
        const msgId = data.result.message_id;
        await dbRepository.updateComment(comment.id, { telegram_message_id: msgId });
        return msgId;
      } else {
        console.error('[TelegramBotService] Error response from Telegram:', data);
        return null;
      }
    } catch (err: any) {
      console.error('[TelegramBotService] Failed to send message:', err.message);
      return null;
    }
  }

  static async startPolling(): Promise<void> {
    if (this.isPolling) return;
    const { token } = await this.getTelegramCredentials();

    if (!token) {
      console.log('[TelegramBotService] Polling Telegram non avviato (manca Bot Token).');
      return;
    }

    this.isPolling = true;
    console.log('[TelegramBotService] Polling aggiornamenti Telegram avviato.');
    this.pollUpdates();
  }

  static stopPolling(): void {
    this.isPolling = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  private static async pollUpdates(): Promise<void> {
    if (!this.isPolling) return;
    const { token } = await this.getTelegramCredentials();

    if (!token) {
      this.isPolling = false;
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.pollingOffset}&timeout=20`;
      const res = await fetch(url);
      const data = await res.json() as any;

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          this.pollingOffset = update.update_id + 1;
          await this.handleUpdate(update, token);
        }
      }
    } catch (err: any) {
      // Ignore network glitch
    }

    if (this.isPolling) {
      this.pollingTimeout = setTimeout(() => this.pollUpdates(), 1000);
    }
  }

  static async handleUpdate(update: any, token: string): Promise<void> {
    // 1. Inline Buttons Callback Query
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data as string;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      const [action, commentId] = data.split(':');
      const comment = await dbRepository.getCommentById(commentId);

      if (!comment) {
        await this.answerCallback(token, cb.id, 'Commento non trovato');
        return;
      }

      if (action === 'appr') {
        // Publish to TikTok or Facebook/Instagram
        if (comment.platform?.toLowerCase() === 'tiktok') {
          await TikTokPublisherService.publishReply(comment.id, comment.proposed_reply);
        } else {
          await MetaPublisherService.publishReply(comment.id, comment.proposed_reply);
        }

        await dbRepository.updateComment(comment.id, {
          status: 'approved',
          final_reply: comment.proposed_reply,
          replied_at: new Date().toISOString(),
        });

        await dbRepository.saveApprovedReply({
          profile_id: comment.profile_id,
          comment_id: comment.id,
          platform: comment.platform,
          comment_text: comment.comment_text,
          approved_reply: comment.proposed_reply,
        });

        await this.answerCallback(token, cb.id, '✅ Risposta approvata!');
        await this.editMessageText(
          token,
          chatId,
          messageId,
          `✅ <b>APPROVATO & PUBBLICATO SU ${comment.platform.toUpperCase()}</b>\n\n` +
          `💬 <b>Commento:</b> <i>"${this.escapeHtml(comment.comment_text)}"</i>\n` +
          `📤 <b>Risposta inviata:</b>\n<blockquote>"${this.escapeHtml(comment.proposed_reply)}"</blockquote>\n` +
          `<i>(Memorizzato nel profilo per l'apprendimento futuro)</i>`
        );
      } else if (action === 'regn') {
        await this.answerCallback(token, cb.id, '🔄 Rigenerazione in corso...');
        const newReply = await AIOrchestrator.generateReply({
          profileId: comment.profile_id,
          platform: comment.platform,
          authorUsername: comment.author_username,
          commentText: comment.comment_text,
          postSnippet: comment.post_snippet,
        });

        await dbRepository.updateComment(comment.id, {
          proposed_reply: newReply.proposedReply,
        });

        comment.proposed_reply = newReply.proposedReply;
        await this.editMessageText(
          token,
          chatId,
          messageId,
          `🔔 <b>Nuovo Commento su ${comment.platform.toUpperCase()} (Rigenerato)</b>\n\n` +
          `👤 <b>Autore:</b> @${this.escapeHtml(comment.author_username)}\n` +
          `💬 <b>Commento:</b> <blockquote>"${this.escapeHtml(comment.comment_text)}"</blockquote>\n\n` +
          `🤖 <b>Nuova Proposta AI:</b>\n<blockquote>"${this.escapeHtml(newReply.proposedReply)}"</blockquote>`,
          cb.message?.reply_markup
        );
      } else if (action === 'edit') {
        this.pendingEdits.set(String(chatId), comment.id);
        await this.answerCallback(token, cb.id, '✏️ Invia ora il testo della tua risposta');
        await this.sendMessage(
          token,
          chatId,
          `✏️ <b>Modifica Risposta</b> per @${comment.author_username}:\nScrivi e invia la risposta desiderata:`
        );
      } else if (action === 'rjct') {
        await dbRepository.updateComment(comment.id, { status: 'rejected' });
        await this.answerCallback(token, cb.id, '❌ Scartato');
        await this.editMessageText(
          token,
          chatId,
          messageId,
          `❌ <b>COMMENTO SCARTATO</b>\n\n` +
          `👤 <b>Autore:</b> @${this.escapeHtml(comment.author_username)}\n` +
          `💬 <b>Commento:</b> <i>"${this.escapeHtml(comment.comment_text)}"</i>`
        );
      }
    }

    // 2. User Text Reply (Manual Edit)
    if (update.message?.text) {
      const chatId = String(update.message.chat.id);
      const text = update.message.text.trim();

      if (text === '/start' || text === '/status') {
        await this.sendMessage(
          token,
          chatId,
          `🧬 <b>DNAReplya Bot Attivo!</b>\nChat ID attuale: <code>${chatId}</code>`
        );
        return;
      }

      if (this.pendingEdits.has(chatId)) {
        const commentId = this.pendingEdits.get(chatId)!;
        this.pendingEdits.delete(chatId);
        const comment = await dbRepository.getCommentById(commentId);

        if (comment) {
          if (comment.platform?.toLowerCase() === 'tiktok') {
            await TikTokPublisherService.publishReply(comment.id, text);
          } else {
            await MetaPublisherService.publishReply(comment.id, text);
          }

          await dbRepository.updateComment(comment.id, {
            status: 'modified',
            final_reply: text,
            replied_at: new Date().toISOString(),
          });

          await dbRepository.saveApprovedReply({
            profile_id: comment.profile_id,
            comment_id: comment.id,
            platform: comment.platform,
            comment_text: comment.comment_text,
            approved_reply: text,
          });

          await this.sendMessage(
            token,
            chatId,
            `✅ <b>Risposta Personalizzata Salvata & Pubblicata!</b>\n\n` +
            `📤 <b>Testo:</b>\n<blockquote>"${this.escapeHtml(text)}"</blockquote>\n` +
            `<i>(L'AI ha memorizzato questa risposta nello stile del cliente)</i>`
          );
        }
      }
    }
  }

  private static async sendMessage(token: string, chatId: string | number, text: string): Promise<void> {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  }

  private static async editMessageText(
    token: string,
    chatId: string | number,
    messageId: number,
    text: string,
    replyMarkup?: any
  ): Promise<void> {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
  }

  private static async answerCallback(token: string, callbackQueryId: string, text: string): Promise<void> {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  }

  private static escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
