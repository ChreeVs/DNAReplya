import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';
import { MetaSyncService } from '../../services/social/metaSync.js';
import { MetaPublisherService } from '../../services/social/metaPublisher.js';
import { AIOrchestrator } from '../../services/ai/orchestrator.js';

const router = Router();

// GET comments (optionally filtered by profileId)
router.get('/', async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const limit = parseInt(req.query.limit as string, 10) || 100;

    let comments: any[] = [];
    if (profileId) {
      comments = await dbRepository.getCommentsByProfile(profileId, limit);
    } else {
      const profiles = await dbRepository.getAllProfiles();
      if (profiles.length > 0) {
        comments = await dbRepository.getCommentsByProfile(profiles[0].id, limit);
      }
    }

    res.json({ success: true, comments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/comments/cron-check - Endpoint per trigger esterno (es. cron-job.org ogni 3 ore)
router.get('/cron-check', async (req: Request, res: Response) => {
  try {
    console.log('[Comments Route] Avvio controllo commenti periodico /cron-check...');
    const result = await MetaSyncService.syncAllProfilesComments();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/comments/sync - Sincronizzazione manuale per il profilo attivo dal frontend
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string || req.body.profileId;
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'profileId mancante' });
    }

    const result = await MetaSyncService.syncCommentsForProfile(profileId);
    res.json({
      success: true,
      message: `Sincronizzazione completata: controllati ${result.checkedAccounts} canali, trovati ${result.newCommentsFound} nuovi commenti.`,
      ...result,
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

    const finalReply = req.body.final_reply || comment.proposed_reply;

    // 1. Publish directly to Facebook or Instagram via Graph API
    const publishRes = await MetaPublisherService.publishReply(comment.id, finalReply);
    if (!publishRes.success) {
      console.warn(`[Comments Route] Avviso: pubblicazione Graph API ha restituito: ${publishRes.error}`);
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
        : `Risposta approvata localmente (avviso Meta: ${publishRes.error || 'Invio non riuscito'})`,
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

export default router;
