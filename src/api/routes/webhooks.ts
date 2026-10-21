import { Router, Request, Response } from 'express';
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
    console.log('[Meta Webhook] Verifica riuscita');
    return res.status(200).send(challenge);
  }

  console.warn('[Meta Webhook] Token di verifica non valido');
  return res.sendStatus(403);
});

// Meta Webhook Event Ingestion
router.post('/meta', (req: Request, res: Response) => {
  // CRITICAL: Respond HTTP 200 OK immediately within 2 seconds
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (body.object === 'page' || body.object === 'instagram') {
    setImmediate(async () => {
      try {
        const entries = body.entry || [];
        for (const entry of entries) {
          const entryId = entry.id; // page id or ig business account id
          const changes = entry.changes || [];

          // Try to locate which client profile owns this external account
          const platform = body.object === 'instagram' ? 'instagram' : 'facebook';
          const matchedAccount = await dbRepository.findAccountByPlatformAndExternalId(platform, String(entryId));
          
          let profileId = matchedAccount ? matchedAccount.profile_id : '';
          if (!profileId) {
            const allProfiles = await dbRepository.getAllProfiles();
            profileId = allProfiles[0]?.id || 'prof_default';
          }

          const profile = await dbRepository.getProfileById(profileId);

          for (const change of changes) {
            const val = change.value;
            if (val && (change.field === 'feed' || change.field === 'comments')) {
              const itemType = val.item;
              const verb = val.verb;

              if (verb === 'add' || itemType === 'comment') {
                const commentText = val.message || val.text;
                const authorId = val.from?.id ? String(val.from.id) : '';
                const authorName = (val.from?.name || '').trim();

                // Skip comments made by the account itself
                if (authorId && (authorId === String(entryId) || authorId === String(matchedAccount?.external_account_id))) {
                  continue;
                }
                if (authorName && matchedAccount?.account_name && authorName.toLowerCase() === matchedAccount.account_name.toLowerCase()) {
                  continue;
                }

                const authorUsername = authorName || (authorId ? `utente_${authorId.slice(-6)}` : 'utente_meta');
                const commentId = val.comment_id || val.id || `meta_${Date.now()}`;
                const postId = val.post_id || val.media?.id || '';

                if (commentText) {
                  // 1. Generate AI Reply using this Profile's rules and memory
                  const aiResult = await AIOrchestrator.generateReply({
                    profileId,
                    platform,
                    authorUsername,
                    commentText,
                  });

                  // 2. Check if this profile has auto-pilot enabled
                  const isAutoPilot = Boolean(profile?.auto_pilot_enabled);
                  const initialStatus = isAutoPilot ? 'auto_replied' : 'pending';

                  const record = await dbRepository.insertComment({
                    id: commentId,
                    profile_id: profileId,
                    social_account_id: matchedAccount?.id || null,
                    platform,
                    platform_post_id: postId,
                    platform_comment_id: commentId,
                    author_username: authorUsername,
                    comment_text: commentText,
                    proposed_reply: aiResult.proposedReply,
                    final_reply: isAutoPilot ? aiResult.proposedReply : '',
                    status: initialStatus,
                  });

                  // 3. Dispatch to Telegram (with Profile details)
                  if (!isAutoPilot) {
                    await TelegramBotService.sendCommentNotification(record);
                  } else {
                    // Save to memory
                    await dbRepository.saveApprovedReply({
                      profile_id: profileId,
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

// Telegram Webhook
router.post('/telegram', async (req: Request, res: Response) => {
  res.status(200).send('OK');

  const { token } = await TelegramBotService.getTelegramCredentials();
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
