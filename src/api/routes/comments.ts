import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';
import { MetaSyncService } from '../../services/social/metaSync.js';
import { TikTokSyncService } from '../../services/social/tiktokSync.js';
import { MetaPublisherService } from '../../services/social/metaPublisher.js';
import { TikTokPublisherService } from '../../services/social/tiktokPublisher.js';
import { AIOrchestrator } from '../../services/ai/orchestrator.js';
import { SchedulerService } from '../../services/scheduler/index.js';

const router = Router();

// GET comments (optionally filtered by profileId, limit, since, until)
router.get('/', async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const limit = parseInt(req.query.limit as string, 10) || 500;
    const since = req.query.since as string || req.query.dateFrom as string;
    const until = req.query.until as string || req.query.dateTo as string;

    let comments: any[] = [];
    if (profileId) {
      comments = await dbRepository.getCommentsByProfile(profileId, limit, since, until);
    } else {
      const profiles = await dbRepository.getAllProfiles();
      if (profiles.length > 0) {
        comments = await dbRepository.getCommentsByProfile(profiles[0].id, limit, since, until);
      }
    }

    // Auto-enrich placeholder Facebook author names on the fly
    for (const c of comments) {
      if (c.platform === 'facebook' && (!c.author_name || c.author_name === 'Utente Facebook' || c.author_name === 'Utente Social' || c.author_name.startsWith('fb_') || c.author_name.startsWith('utente_'))) {
        try {
          const accounts = await dbRepository.getSocialAccountsByProfile(c.profile_id);
          const fbAcc = accounts.find(a => a.id === c.social_account_id || a.platform === 'facebook');
          const token = fbAcc?.access_token;
          const commId = c.platform_comment_id;

          if (token && commId) {
            const cleanId = commId.replace(/^fb_/, '').trim();
            const candidateIds = [cleanId];
            if (cleanId.includes('_')) candidateIds.push(cleanId.split('_')[1]);

            let resolvedName = '';
            for (const testId of candidateIds) {
              if (resolvedName) break;
              try {
                const detailRes = await fetch(`https://graph.facebook.com/v20.0/${testId}?fields=from{id,name},message&access_token=${token}`);
                if (detailRes.ok) {
                  const detailData = await detailRes.json() as any;
                  if (detailData.from?.name) {
                    resolvedName = detailData.from.name.trim();
                  } else if (detailData.from?.id) {
                    const uRes = await fetch(`https://graph.facebook.com/v20.0/${detailData.from.id}?fields=name,short_name,first_name,last_name&access_token=${token}`);
                    if (uRes.ok) {
                      const uData = await uRes.json() as any;
                      const nameCand = uData.name || (uData.first_name ? `${uData.first_name} ${uData.last_name || ''}`.trim() : '');
                      if (nameCand) resolvedName = nameCand;
                    }
                  }
                }
              } catch {
                // ignore
              }
            }

            if (resolvedName) {
              console.log(`[Facebook Name Resolved] Commento ${commId} -> ${resolvedName}`);
              c.author_name = resolvedName;
              c.author_username = resolvedName;
              await dbRepository.updateComment(c.id, { author_name: resolvedName, author_username: resolvedName });
            }
          }
        } catch {
          // ignore to keep response fast
        }
      }
    }

    res.json({ success: true, comments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/comments/sync-status - Restituisce countdown e orario prossimo sync automatico
router.get('/sync-status', (req: Request, res: Response) => {
  res.json({ success: true, ...SchedulerService.getSyncStatus() });
});

// GET /api/comments/cron-check - Endpoint per trigger esterno
router.get('/cron-check', async (req: Request, res: Response) => {
  try {
    console.log('[Comments Route] Avvio controllo commenti periodico /cron-check...');
    SchedulerService.notifyManualSync();
    const metaRes = await MetaSyncService.syncAllProfilesComments();
    const tiktokRes = await TikTokSyncService.syncAllProfilesComments();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      meta: metaRes,
      tiktok: tiktokRes,
      totalNew: metaRes.totalNewComments + tiktokRes.totalNewComments,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/comments/sync - Sincronizzazione per il profilo attivo (supporta range date storiche per Meta)
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const profileId = (req.query.profileId as string) || req.body.profileId;
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'profileId mancante' });
    }

    const since = (req.query.since as string) || (req.body.since as string) || (req.query.dateFrom as string) || (req.body.dateFrom as string);
    const until = (req.query.until as string) || (req.body.until as string) || (req.query.dateTo as string) || (req.body.dateTo as string);
    const limit = parseInt((req.query.limit as string) || (req.body.limit as string), 10);

    SchedulerService.notifyManualSync();
    const metaRes = await MetaSyncService.syncCommentsForProfile(profileId, { since, until, limit });
    const tiktokRes = await TikTokSyncService.syncCommentsForProfile(profileId);
    const totalNew = metaRes.newCommentsFound + tiktokRes.newCommentsFound;
    const totalChecked = metaRes.checkedAccounts + tiktokRes.checkedAccounts;

    let periodMsg = '';
    if (since || until) {
      periodMsg = ` (Periodo: ${since || 'inizio'} → ${until || 'oggi'})`;
    }

    res.json({
      success: true,
      message: `Sincronizzazione completata${periodMsg}: controllati ${totalChecked} canali, trovati ${totalNew} nuovi commenti (${metaRes.newCommentsFound} Meta, ${tiktokRes.newCommentsFound} TikTok).`,
      meta: metaRes,
      tiktok: tiktokRes,
      newCommentsFound: totalNew,
      checkedAccounts: totalChecked,
      syncStatus: SchedulerService.getSyncStatus(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET approved replies memory (isolated per profile)
router.get('/approved-memory', async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    if (!profileId) {
      const profiles = await dbRepository.getAllProfiles();
      const firstId = profiles[0]?.id;
      const memory = firstId ? await dbRepository.getApprovedRepliesByProfile(firstId, limit) : [];
      return res.json({ success: true, memory });
    }

    const memory = await dbRepository.getApprovedRepliesByProfile(profileId, limit);
    res.json({ success: true, memory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE a specific item from approved replies memory
router.delete('/approved-memory/:id', async (req: Request, res: Response) => {
  try {
    const memoryId = String(req.params.id);
    if (!memoryId) {
      return res.status(400).json({ success: false, error: 'ID elemento mancante' });
    }
    await dbRepository.deleteApprovedReply(memoryId);
    res.json({ success: true, message: 'Elemento rimosso dalla memoria di apprendimento' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST approve a comment from dashboard
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = await dbRepository.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Commento non trovato' });
    }

    const finalReply = req.body?.final_reply || comment.proposed_reply || '';

    // 1. Publish directly to Facebook, Instagram or TikTok
    let publishRes: { success: boolean; error?: string; publishedId?: string };
    if (comment.platform?.toLowerCase() === 'tiktok') {
      publishRes = await TikTokPublisherService.publishReply(comment.id, finalReply);
    } else {
      publishRes = await MetaPublisherService.publishReply(comment.id, finalReply);
    }

    if (!publishRes.success) {
      console.warn(`[Comments Route] Avviso: pubblicazione ${comment.platform} ha restituito: ${publishRes.error}`);
    }

    // 2. Update status in local DB
    await dbRepository.updateComment(comment.id, {
      status: 'approved',
      final_reply: finalReply,
      replied_at: new Date().toISOString(),
    });

    // 3. Save to profile-isolated learning memory
    await dbRepository.saveApprovedReply({
      profile_id: comment.profile_id,
      comment_id: comment.id,
      platform: comment.platform,
      comment_text: comment.comment_text,
      approved_reply: finalReply,
    });

    res.json({
      success: true,
      platform: comment.platform,
      publishedToSocial: publishRes.success,
      publishError: publishRes.error,
      message: publishRes.success
        ? `Risposta approvata e pubblicata su ${comment.platform.toUpperCase()}!`
        : `Risposta approvata localmente (avviso ${comment.platform.toUpperCase()}: ${publishRes.error || 'Invio non riuscito'})`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST reject a comment
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = await dbRepository.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Commento non trovato' });
    }

    await dbRepository.updateComment(comment.id, { status: 'rejected' });
    res.json({ success: true, message: 'Commento scartato' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST regenerate AI reply for a comment
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = await dbRepository.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Commento non trovato' });
    }

    const aiResult = await AIOrchestrator.generateReply({
      profileId: comment.profile_id,
      platform: comment.platform,
      authorUsername: comment.author_username,
      commentText: comment.comment_text,
      postSnippet: comment.post_snippet,
    });

    await dbRepository.updateComment(comment.id, {
      proposed_reply: aiResult.proposedReply,
    });

    res.json({
      success: true,
      proposedReply: aiResult.proposedReply,
      modelUsed: aiResult.modelUsed,
      providerUsed: aiResult.providerUsed,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// BULK ACTIONS
// POST /api/comments/bulk-approve
router.post('/bulk-approve', async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body?.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun commento selezionato' });
    }

    let approvedCount = 0;
    let publishedCount = 0;

    for (const id of ids) {
      const comment = await dbRepository.getCommentById(id);
      if (!comment || comment.status === 'approved') continue;

      const replyText = comment.final_reply || comment.proposed_reply || '';
      if (!replyText || replyText.startsWith('[Errore AI')) continue;

      let pubRes = { success: false };
      if (comment.platform?.toLowerCase() === 'tiktok') {
        pubRes = await TikTokPublisherService.publishReply(comment.id, replyText);
      } else {
        pubRes = await MetaPublisherService.publishReply(comment.id, replyText);
      }

      if (pubRes.success) publishedCount++;

      await dbRepository.updateComment(comment.id, {
        status: 'approved',
        final_reply: replyText,
        replied_at: new Date().toISOString(),
      });

      await dbRepository.saveApprovedReply({
        profile_id: comment.profile_id,
        comment_id: comment.id,
        platform: comment.platform,
        comment_text: comment.comment_text,
        approved_reply: replyText,
      });

      approvedCount++;
    }

    res.json({
      success: true,
      message: `${approvedCount} commenti approvati (${publishedCount} pubblicati sui social).`,
      approvedCount,
      publishedCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/comments/bulk-reject
router.post('/bulk-reject', async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body?.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun commento selezionato' });
    }

    let rejectedCount = 0;
    for (const id of ids) {
      await dbRepository.updateComment(id, { status: 'rejected' });
      rejectedCount++;
    }

    res.json({ success: true, message: `${rejectedCount} commenti scartati.`, rejectedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/comments/bulk-delete
router.post('/bulk-delete', async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body?.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun commento selezionato' });
    }

    let deletedCount = 0;
    for (const id of ids) {
      await dbRepository.deleteComment(id);
      deletedCount++;
    }

    res.json({ success: true, message: `${deletedCount} commenti eliminati definitivamente.`, deletedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE a comment permanently from inbox
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = await dbRepository.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Commento non trovato' });
    }

    await dbRepository.deleteComment(comment.id);
    res.json({ success: true, message: 'Commento eliminato definitivamente dall\'inbox' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/comments/:id/post-url - Resolves exact post permalink for Instagram, Facebook, TikTok
router.get('/:id/post-url', async (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = await dbRepository.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Commento non trovato' });
    }

    // 1. If already stored, return directly
    if (comment.post_url && comment.post_url.trim()) {
      return res.json({ success: true, url: comment.post_url.trim() });
    }

    const platform = (comment.platform || '').toLowerCase();

    // 2. Resolve for Instagram Media Permalink
    if (platform === 'instagram') {
      const accounts = await dbRepository.getSocialAccountsByProfile(comment.profile_id);
      const acc = accounts.find(a => a.id === comment.social_account_id || a.platform === 'instagram');
      const token = acc?.access_token;
      const mediaId = comment.platform_post_id;

      if (token && mediaId) {
        try {
          const igRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}?fields=permalink&access_token=${token}`);
          if (igRes.ok) {
            const igData = await igRes.json() as any;
            if (igData.permalink) {
              await dbRepository.updateComment(comment.id, { post_url: igData.permalink });
              return res.json({ success: true, url: igData.permalink });
            }
          }
        } catch (e) {
          console.warn('[Instagram Permalink Fetch Error]', e);
        }
      }

      // Fallback: if account handle is known
      const handle = (acc?.account_handle || '').replace(/^@/, '');
      if (handle) {
        return res.json({ success: true, url: `https://www.instagram.com/${handle}/` });
      }
      return res.json({ success: true, url: 'https://www.instagram.com' });
    }

    // 3. Resolve for Facebook
    if (platform === 'facebook') {
      const accounts = await dbRepository.getSocialAccountsByProfile(comment.profile_id);
      const acc = accounts.find(a => a.id === comment.social_account_id || a.platform === 'facebook');
      const token = acc?.access_token;
      const postId = comment.platform_post_id;

      if (token && postId) {
        try {
          const fbRes = await fetch(`https://graph.facebook.com/v20.0/${postId}?fields=permalink_url&access_token=${token}`);
          if (fbRes.ok) {
            const fbData = await fbRes.json() as any;
            if (fbData.permalink_url) {
              await dbRepository.updateComment(comment.id, { post_url: fbData.permalink_url });
              return res.json({ success: true, url: fbData.permalink_url });
            }
          }
        } catch (e) {
          console.warn('[Facebook Permalink Fetch Error]', e);
        }
      }

      if (postId) {
        return res.json({ success: true, url: `https://www.facebook.com/${postId}` });
      }
      return res.json({ success: true, url: 'https://www.facebook.com' });
    }

    // 4. Resolve for TikTok
    if (platform === 'tiktok') {
      const accounts = await dbRepository.getSocialAccountsByProfile(comment.profile_id);
      const acc = accounts.find(a => a.id === comment.social_account_id || a.platform === 'tiktok');
      const handle = (acc?.account_handle || '').replace(/^@/, '');
      if (comment.platform_post_id && handle) {
        const url = `https://www.tiktok.com/@${handle}/video/${comment.platform_post_id}`;
        await dbRepository.updateComment(comment.id, { post_url: url });
        return res.json({ success: true, url });
      }
      return res.json({ success: true, url: 'https://www.tiktok.com' });
    }

    res.json({ success: true, url: `https://www.google.com/search?q=${encodeURIComponent(comment.comment_text)}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
