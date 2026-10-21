import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { dbRepository } from '../../db/index.js';
import { AIOrchestrator } from '../../services/ai/orchestrator.js';
import { TelegramBotService } from '../../services/telegram/bot.js';

const router = Router();

router.post('/send', async (req: Request, res: Response) => {
  try {
    const {
      platform = 'instagram',
      authorUsername = 'utente_social',
      authorName = 'Utente Test',
      commentText,
      postSnippet = 'Post su novità e servizi',
    } = req.body;

    if (!commentText) {
      return res.status(400).json({ success: false, error: 'Il testo del commento è obbligatorio' });
    }

    const commentId = `sim_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // 1. Generate AI proposed reply
    const aiResult = await AIOrchestrator.generateReply({
      platform,
      authorUsername,
      commentText,
      postSnippet,
    });

    const settings = dbRepository.getSettings();
    const isAutoPilot = Boolean(settings.auto_pilot_enabled);

    // 2. Insert into database
    const initialStatus = isAutoPilot ? 'auto_replied' : 'pending';
    const finalReply = isAutoPilot ? aiResult.proposedReply : '';

    const commentRecord = dbRepository.insertComment({
      id: commentId,
      platform,
      platform_post_id: 'post_sim_123',
      platform_comment_id: `comm_${Date.now()}`,
      author_username: authorUsername,
      author_name: authorName,
      comment_text: commentText,
      post_snippet: postSnippet,
      proposed_reply: aiResult.proposedReply,
      final_reply: finalReply,
      status: initialStatus,
    });

    // 3. If auto-pilot, immediately save to learning memory
    if (isAutoPilot) {
      dbRepository.saveApprovedReply({
        comment_id: commentId,
        platform,
        comment_text: commentText,
        approved_reply: aiResult.proposedReply,
      });
    }

    // 4. Send Telegram notification
    let telegramMsgId: number | null = null;
    try {
      telegramMsgId = await TelegramBotService.sendCommentNotification(commentRecord);
    } catch (e: any) {
      console.warn('[Simulator] Could not send to Telegram:', e.message);
    }

    res.json({
      success: true,
      comment: {
        ...commentRecord,
        telegram_message_id: telegramMsgId,
        model_used: aiResult.modelUsed,
        provider_used: aiResult.providerUsed,
        few_shot_examples_count: aiResult.fewShotExamplesCount,
      },
    });
  } catch (err: any) {
    console.error('[Simulator Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
