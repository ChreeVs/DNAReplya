import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import { dbRepository } from '../../db/index.js';
import { AIOrchestrator } from '../../services/ai/orchestrator.js';
import { TelegramBotService } from '../../services/telegram/bot.js';

const router = Router();

// Meta Webhook Verification (Instagram & Facebook Pages)
router.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    console.log('[Meta Webhook] Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[Meta Webhook] Verification token mismatch');
  return res.sendStatus(403);
});

// Meta Webhook Event Ingestion
router.post('/meta', (req: Request, res: Response) => {
  // CRITICAL RULE: Respond 200 OK immediately within 1-2 seconds
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (body.object === 'page' || body.object === 'instagram') {
    // Process asynchronously in background
    setImmediate(async () => {
      try {
        const entries = body.entry || [];
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            const val = change.value;
            // Check for comment additions
            if (val && (change.field === 'feed' || change.field === 'comments')) {
              const itemType = val.item; // 'comment'
              const verb = val.verb; // 'add'

              if (verb === 'add' || itemType === 'comment') {
                const commentText = val.message || val.text;
                const authorUsername = val.from?.name || val.from?.id || 'utente_meta';
                const commentId = val.comment_id || val.id || `meta_${Date.now()}`;
                const postId = val.post_id || val.media?.id || '';

                if (commentText) {
                  const platform = body.object === 'instagram' ? 'instagram' : 'facebook';

                  // 1. Generate AI Reply
                  const aiResult = await AIOrchestrator.generateReply({
                    platform,
                    authorUsername,
                    commentText,
                  });

                  // 2. Insert into DB
                  const settings = dbRepository.getSettings();
                  const isAutoPilot = Boolean(settings.auto_pilot_enabled);
                  const initialStatus = isAutoPilot ? 'auto_replied' : 'pending';

                  const record = dbRepository.insertComment({
                    id: commentId,
                    platform,
                    platform_post_id: postId,
                    platform_comment_id: commentId,
                    author_username: authorUsername,
                    comment_text: commentText,
                    proposed_reply: aiResult.proposedReply,
                    final_reply: isAutoPilot ? aiResult.proposedReply : '',
                    status: initialStatus,
                  });

                  // 3. Dispatch to Telegram
                  if (!isAutoPilot) {
                    await TelegramBotService.sendCommentNotification(record);
                  } else {
                    // Save to memory
                    dbRepository.saveApprovedReply({
                      comment_id: commentId,
                      platform,
                      comment_text: commentText,
                      approved_reply: aiResult.proposedReply,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[Meta Webhook Async Error]', err);
      }
    });
  }
});

// Telegram Webhook (Alternative to Long Polling in Production)
router.post('/telegram', async (req: Request, res: Response) => {
  res.status(200).send('OK');

  const settings = dbRepository.getSettings();
  const token = settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;

  if (token && req.body) {
    setImmediate(async () => {
      try {
        await TelegramBotService.handleUpdate(req.body, token);
      } catch (err: any) {
        console.error('[Telegram Webhook Error]', err);
      }
    });
  }
});

export default router;
