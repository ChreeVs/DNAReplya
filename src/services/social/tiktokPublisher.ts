import { dbRepository } from '../../db/index.js';

export class TikTokPublisherService {
  /**
   * Publishes an approved reply to a TikTok comment via TikTok Business API (v1.3)
   * Official Endpoint: POST https://business-api.tiktok.com/open_api/v1.3/business/comment/reply/create/
   */
  static async publishReply(
    commentId: string,
    replyText: string
  ): Promise<{ success: boolean; error?: string; publishedId?: string }> {
    try {
      const comment = await dbRepository.getCommentById(commentId);
      if (!comment) {
        return { success: false, error: 'Commento non trovato nel database' };
      }

      // If there's no platform comment ID, we cannot reply to a social post
      if (!comment.platform_comment_id) {
        console.log(`[TikTokPublisher] Commento ${commentId} non ha un platform_comment_id esterno.`);
        return { success: true };
      }

      // Find the associated TikTok social account token
      let socialAccount = null;
      if (comment.social_account_id) {
        const accounts = await dbRepository.getSocialAccountsByProfile(comment.profile_id);
        socialAccount = accounts.find(a => a.id === comment.social_account_id);
      }

      if (!socialAccount) {
        const accounts = await dbRepository.getSocialAccountsByProfile(comment.profile_id);
        socialAccount = accounts.find(a => a.platform.toLowerCase() === 'tiktok' && a.access_token);
      }

      if (!socialAccount || !socialAccount.access_token) {
        console.warn(`[TikTokPublisher] Nessun account TikTok con Access Token trovato per il profilo ${comment.profile_id}.`);
        return {
          success: false,
          error: 'Nessun account TikTok con Access Token collegato per questo profilo. Inserisci il token in Canali Social.',
        };
      }

      const accessToken = socialAccount.access_token.trim();
      const videoId = comment.platform_post_id?.trim() || '';
      const parentCommentId = comment.platform_comment_id?.trim() || '';

      if (!videoId || !parentCommentId) {
        return {
          success: false,
          error: 'ID Video TikTok o ID Commento mancante nei metadati del commento.',
        };
      }

      console.log(`[TikTokPublisher] Pubblicazione risposta su TikTok (Video: ${videoId}, Comment: ${parentCommentId})...`);

      const url = 'https://business-api.tiktok.com/open_api/v1.3/business/comment/reply/create/';
      const payload = {
        video_id: videoId,
        comment_id: parentCommentId,
        text: replyText.trim(),
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000), // 12s timeout
      });

      const data = (await res.json()) as any;

      // TikTok Business API response format:
      // Success: { code: 0, message: "OK", data: { comment_id: "...", ... } }
      if (data.code === 0) {
        const newReplyId = data.data?.comment_id || data.data?.id || 'tiktok_reply_ok';
        console.log(`[TikTokPublisher] ✅ Risposta pubblicata su TikTok! ID: ${newReplyId}`);
        return { success: true, publishedId: newReplyId };
      } else {
        const errMessage = data.message || `Errore TikTok API (code: ${data.code})`;
        console.error(`[TikTokPublisher] ❌ Errore risposta TikTok:`, data);
        return { success: false, error: errMessage };
      }
    } catch (err: any) {
      console.error('[TikTokPublisher Exception]', err);
      return { success: false, error: err.message || 'Timeout o errore di connessione con le API di TikTok' };
    }
  }
}
