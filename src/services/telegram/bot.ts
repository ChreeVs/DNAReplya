import { dbRepository, CommentRecord } from '../../db/index.js';
import { AIOrchestrator } from '../ai/orchestrator.js';

export class TelegramBotService {
  private static isPolling = false;
  private static pollingOffset = 0;
  private static pollingTimeout: NodeJS.Timeout | null = null;
  private static pendingEdits: Map<string, string> = new Map(); // chatId -> commentId

  /**
   * Sends a structured comment notification to Telegram with inline approval buttons
   */
  static async sendCommentNotification(comment: CommentRecord): Promise<number | null> {
    const settings = dbRepository.getSettings();
    const token = settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = settings.telegram_admin_chat_id || process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!token || !chatId) {
      console.log(`[TelegramBotService] Token o Chat ID non configurati. Notifica saltata.`);
      return null;
    }

    const platformIcons: Record<string, string> = {
      instagram: '📸 Instagram',
      facebook: '📘 Facebook',
      threads: '🧵 Threads',
      linkedin: '💼 LinkedIn',
      tiktok: '🎵 TikTok',
      x: '🐦 X (Twitter)',
      simulator: '🧪 Simulatore',
    };

    const icon = platformIcons[comment.platform.toLowerCase()] || `🌐 ${comment.platform}`;

    const text = `
🔔 <b>Nuovo Commento su ${icon}</b>

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
        dbRepository.updateComment(comment.id, { telegram_message_id: msgId });
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

  /**
   * Starts background long polling for Telegram updates (ideal for local dev)
   */
  static startPolling(): void {
    if (this.isPolling) return;
    const settings = dbRepository.getSettings();
    const token = settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      console.log('[TelegramBotService] Polling non avviato: Bot Token non presente.');
      return;
    }

    this.isPolling = true;
    console.log('[TelegramBotService] Iniziato polling aggiornamenti Telegram...');
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

    const settings = dbRepository.getSettings();
    const token = settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;

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
      // Ignore network timeout or connection drops, retry after a short pause
    }

    if (this.isPolling) {
      this.pollingTimeout = setTimeout(() => this.pollUpdates(), 1000);
    }
  }

  /**
   * Processes incoming Telegram update (callback button clicks or user text replies)
   */
  static async handleUpdate(update: any, token: string): Promise<void> {
    // 1. Handle Inline Keyboard Callback Queries
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data as string;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      const [action, commentId] = data.split(':');
      const comment = dbRepository.getCommentById(commentId);

      if (!comment) {
        await this.answerCallback(token, cb.id, 'Commento non trovato nel database');
        return;
      }

      if (action === 'appr') {
        // APPROVE & PUBLISH
        dbRepository.updateComment(comment.id, {
          status: 'approved',
          final_reply: comment.proposed_reply,
          replied_at: new Date().toISOString(),
        });

        // Save to Learning Memory (Dynamic Few-Shot Store)
        dbRepository.saveApprovedReply({
          comment_id: comment.id,
          platform: comment.platform,
          comment_text: comment.comment_text,
          approved_reply: comment.proposed_reply,
        });

        await this.answerCallback(token, cb.id, '✅ Risposta approvata e pubblicata!');
        await this.editMessageText(
          token,
          chatId,
          messageId,
          `✅ <b>APPROVATO & PUBBLICATO SU ${comment.platform.toUpperCase()}</b>\n\n` +
          `💬 <b>Commento:</b> <i>"${this.escapeHtml(comment.comment_text)}"</i>\n` +
          `📤 <b>Risposta inviata:</b>\n<blockquote>"${this.escapeHtml(comment.proposed_reply)}"</blockquote>\n` +
          `<i>(Memorizzato nel Knowledge Base per l'apprendimento futuro)</i>`
        );
      } else if (action === 'regn') {
        // REGENERATE
        await this.answerCallback(token, cb.id, '🔄 Rigenerazione in corso con LLM...');
        const newReply = await AIOrchestrator.generateReply({
          platform: comment.platform,
          authorUsername: comment.author_username,
          commentText: comment.comment_text,
          postSnippet: comment.post_snippet,
        });

        dbRepository.updateComment(comment.id, {
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
        // REQUEST MANUAL EDIT
        this.pendingEdits.set(String(chatId), comment.id);
        await this.answerCallback(token, cb.id, '✏️ Invia ora un messaggio con il testo della tua risposta');
        await this.sendMessage(
          token,
          chatId,
          `✏️ <b>Modalità Modifica</b> per il commento di @${comment.author_username}:\n` +
          `Scrivi e invia qui sotto la risposta che desideri pubblicare.`
        );
      } else if (action === 'rjct') {
        // REJECT
        dbRepository.updateComment(comment.id, {
          status: 'rejected',
        });

        await this.answerCallback(token, cb.id, '❌ Commento archiviato senza risposta.');
        await this.editMessageText(
          token,
          chatId,
          messageId,
          `❌ <b>COMMENTO SCARTATO</b>\n\n` +
          `👤 <b>Autore:</b> @${this.escapeHtml(comment.author_username)}\n` +
          `💬 <b>Commento:</b> <i>"${this.escapeHtml(comment.comment_text)}"</i>\n` +
          `<i>(Nessuna risposta pubblicata)</i>`
        );
      }
    }

    // 2. Handle Text Messages (for manual edits or commands)
    if (update.message?.text) {
      const chatId = String(update.message.chat.id);
      const text = update.message.text.trim();

      if (text === '/start' || text === '/status') {
        const settings = dbRepository.getSettings();
        await this.sendMessage(
          token,
          chatId,
          `🧬 <b>DNAReplya Bot Attivo!</b>\n\n` +
          `🤖 <b>Provider AI:</b> ${settings.ai_provider.toUpperCase()} (${settings.ai_model})\n` +
          `🎨 <b>Tono di voce:</b> ${settings.tone_of_voice}\n` +
          `⚡ <b>Auto-Pilot:</b> ${settings.auto_pilot_enabled ? 'ATTIVO' : 'DISATTIVO (Richiede approvazione)'}\n` +
          `Chat ID attuale: <code>${chatId}</code> (Usa questo nella Dashboard)`
        );
        return;
      }

      // Check if user is replying to a pending edit
      if (this.pendingEdits.has(chatId)) {
        const commentId = this.pendingEdits.get(chatId)!;
        this.pendingEdits.delete(chatId);
        const comment = dbRepository.getCommentById(commentId);

        if (comment) {
          dbRepository.updateComment(comment.id, {
            status: 'modified',
            final_reply: text,
            replied_at: new Date().toISOString(),
          });

          // Save manual edit to Few-Shot store to learn from human correction!
          dbRepository.saveApprovedReply({
            comment_id: comment.id,
            platform: comment.platform,
            comment_text: comment.comment_text,
            approved_reply: text,
          });

          await this.sendMessage(
            token,
            chatId,
            `✅ <b>Risposta Personalizzata Salvata & Pubblicata!</b>\n\n` +
            `📤 <b>Testo inviato:</b>\n<blockquote>"${this.escapeHtml(text)}"</blockquote>\n` +
            `<i>(L'AI ha memorizzato questa correzione per i prossimi commenti)</i>`
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
