import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';

const router = Router();

// GET recent comments
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const comments = dbRepository.getRecentComments(limit);
    res.json({ success: true, comments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET approved replies (Learning Memory Store)
router.get('/approved-memory', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const memory = dbRepository.getApprovedReplies(limit);
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

    // Save to learning memory
    dbRepository.saveApprovedReply({
      comment_id: comment.id,
      platform: comment.platform,
      comment_text: comment.comment_text,
      approved_reply: finalReply,
    });

    res.json({ success: true, message: 'Commento approvato e salvato in memoria' });
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
