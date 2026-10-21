import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';

const router = Router();

// GET comments (optionally filtered by profileId)
router.get('/', (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    let comments: any[] = [];
    if (profileId) {
      comments = dbRepository.getCommentsByProfile(profileId, limit);
    } else {
      // Return comments for first profile if not specified
      const profiles = dbRepository.getAllProfiles();
      if (profiles.length > 0) {
        comments = dbRepository.getCommentsByProfile(profiles[0].id, limit);
      }
    }

    res.json({ success: true, comments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET approved replies memory (isolated per profile)
router.get('/approved-memory', (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    if (!profileId) {
      const profiles = dbRepository.getAllProfiles();
      const firstId = profiles[0]?.id;
      const memory = firstId ? dbRepository.getApprovedRepliesByProfile(firstId, limit) : [];
      return res.json({ success: true, memory });
    }

    const memory = dbRepository.getApprovedRepliesByProfile(profileId, limit);
    res.json({ success: true, memory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST approve a comment from dashboard
router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = dbRepository.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Commento non trovato' });
    }

    const finalReply = req.body.final_reply || comment.proposed_reply;

    dbRepository.updateComment(comment.id, {
      status: 'approved',
      final_reply: finalReply,
      replied_at: new Date().toISOString(),
    });

    // Save to profile-isolated learning memory!
    dbRepository.saveApprovedReply({
      profile_id: comment.profile_id,
      comment_id: comment.id,
      platform: comment.platform,
      comment_text: comment.comment_text,
      approved_reply: finalReply,
    });

    res.json({ success: true, message: 'Risposta approvata e memorizzata per questo profilo' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST reject a comment
router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = dbRepository.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Commento non trovato' });
    }

    dbRepository.updateComment(comment.id, { status: 'rejected' });
    res.json({ success: true, message: 'Commento scartato' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
