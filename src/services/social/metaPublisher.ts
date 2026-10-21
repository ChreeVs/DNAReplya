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
        // Auto-Like Facebook comment if enabled for this profile
        try {
          const profile = await dbRepository.getProfileById(comment.profile_id);
          const shouldLike = profile ? (profile.auto_like_facebook !== 0) : true;
          if (shouldLike) {
            await this.likeFacebookComment(comment.platform_comment_id, accessToken);
          }
        } catch (likeErr: any) {
          console.warn('[MetaPublisher] Auto-like Facebook non riuscito:', likeErr.message);
        }

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

  /**
   * Puts a "Like" reaction on a Facebook comment using the Page Access Token
   */
  static async likeFacebookComment(platformCommentId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!platformCommentId || !accessToken) return { success: false, error: 'Parametri mancanti' };

      const likeUrl = `https://graph.facebook.com/v20.0/${platformCommentId}/likes`;
      const formParams = new URLSearchParams();
      formParams.append('access_token', accessToken);

      const res = await fetch(likeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
        signal: AbortSignal.timeout(6000),
      });

      const data = await res.json() as any;
      if (data.success || data === true || data.id) {
        console.log(`[MetaPublisher] ❤️ Like automatico messo al commento Facebook ${platformCommentId}`);
        return { success: true };
      } else {
        const errMsg = data.error?.message || JSON.stringify(data);
        console.warn(`[MetaPublisher] Impossibile mettere Like a Facebook ${platformCommentId}:`, errMsg);
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      console.warn(`[MetaPublisher] Eccezione auto-like Facebook ${platformCommentId}:`, err.message);
      return { success: false, error: err.message };
    }
  }
}
