import { dbRepository } from '../../db/index.js';

export class MetaPublisherService {
  /**
   * Publishes an approved reply to Facebook or Instagram via Graph API
   */
  static async publishReply(commentId: string, replyText: string): Promise<{ success: boolean; error?: string; publishedId?: string }> {
    try {
      const comment = await dbRepository.getCommentById(commentId);
      if (!comment) {
        return { success: false, error: 'Commento non trovato nel database' };
      }

      // If there's no platform comment ID, we can't reply to a social post
      if (!comment.platform_comment_id) {
        console.log(`[MetaPublisher] Commento ${commentId} non ha un platform_comment_id esterno.`);
        return { success: true };
      }

      // Find the associated social account token
      let socialAccount = null;
      if (comment.social_account_id) {
        const accounts = await dbRepository.getSocialAccountsByProfile(comment.profile_id);
        socialAccount = accounts.find(a => a.id === comment.social_account_id);
      }

      if (!socialAccount) {
        const accounts = await dbRepository.getSocialAccountsByProfile(comment.profile_id);
        socialAccount = accounts.find(a => a.platform === comment.platform && a.access_token);
      }

      if (!socialAccount || !socialAccount.access_token) {
        console.warn(`[MetaPublisher] Nessun account social con token trovato per commento ${commentId} (${comment.platform}).`);
        return { success: false, error: 'Nessun account social con token di accesso collegato per questo profilo.' };
      }

      const platform = comment.platform.toLowerCase();
      const accessToken = socialAccount.access_token;
      let url = '';

      if (platform === 'facebook') {
        // Facebook Graph API: POST /{comment_id}/comments
        url = `https://graph.facebook.com/v20.0/${comment.platform_comment_id}/comments`;
      } else if (platform === 'instagram') {
        // Instagram Graph API: POST /{comment_id}/replies
        url = `https://graph.facebook.com/v20.0/${comment.platform_comment_id}/replies`;
      } else {
        console.log(`[MetaPublisher] Piattaforma ${platform} non supportata per risposta diretta Graph API.`);
        return { success: true };
      }

      // Meta Graph API requires form-urlencoded parameters
      const formParams = new URLSearchParams();
      formParams.append('message', replyText);
      formParams.append('access_token', accessToken);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
        signal: AbortSignal.timeout(10000), // 10s timeout to never hang
      });

      const data = await res.json() as any;
      if (data.id) {
        console.log(`[MetaPublisher] Risposta pubblicata con successo su ${platform}! ID Risposta: ${data.id}`);
        return { success: true, publishedId: data.id };
      } else {
        const errMessage = data.error?.message || JSON.stringify(data.error || data);
        console.error(`[MetaPublisher] Errore pubblicazione ${platform}:`, errMessage);
        return { success: false, error: errMessage };
      }
    } catch (err: any) {
      console.error('[MetaPublisher Exception]', err);
      return { success: false, error: err.message || 'Timeout o errore di rete con le API Meta' };
    }
  }
}
