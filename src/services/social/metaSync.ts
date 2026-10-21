import { dbRepository } from '../../db/index.js';
import { AIOrchestrator } from '../ai/orchestrator.js';
import { TelegramBotService } from '../telegram/bot.js';
import { MetaPublisherService } from './metaPublisher.js';

export class MetaSyncService {
  /**
   * Syncs comments for a specific profile from all its connected Facebook and Instagram accounts
   */
  static async syncCommentsForProfile(profileId: string): Promise<{
    checkedAccounts: number;
    newCommentsFound: number;
    errors: string[];
  }> {
    const profile = await dbRepository.getProfileById(profileId);
    if (!profile) {
      return { checkedAccounts: 0, newCommentsFound: 0, errors: ['Profilo non trovato'] };
    }

    const accounts = await dbRepository.getSocialAccountsByProfile(profileId);
    const activeMetaAccounts = accounts.filter(
      a => (a.platform === 'facebook' || a.platform === 'instagram') && a.access_token && a.external_account_id
    );

    let checkedAccounts = 0;
    let newCommentsFound = 0;
    const errors: string[] = [];

    for (const acc of activeMetaAccounts) {
      try {
        checkedAccounts++;
        if (acc.platform === 'facebook') {
          const count = await this.syncFacebookPageComments(profile, acc);
          newCommentsFound += count;
        } else if (acc.platform === 'instagram') {
          const count = await this.syncInstagramComments(profile, acc);
          newCommentsFound += count;
        }
      } catch (err: any) {
        console.error(`[MetaSync] Errore sync account ${acc.account_name} (${acc.platform}):`, err.message);
        errors.push(`${acc.account_name}: ${err.message}`);
      }
    }

    return { checkedAccounts, newCommentsFound, errors };
  }

  /**
   * Syncs comments across ALL active profiles
   */
  static async syncAllProfilesComments(): Promise<{
    totalProfiles: number;
    totalAccounts: number;
    totalNewComments: number;
  }> {
    const profiles = await dbRepository.getAllProfiles();
    let totalAccounts = 0;
    let totalNewComments = 0;

    for (const p of profiles) {
      const res = await this.syncCommentsForProfile(p.id);
      totalAccounts += res.checkedAccounts;
      totalNewComments += res.newCommentsFound;
    }

    console.log(`[MetaSync Cron] Sync completato: ${profiles.length} profili, ${totalAccounts} canali, ${totalNewComments} nuovi commenti trovati.`);
    return {
      totalProfiles: profiles.length,
      totalAccounts,
      totalNewComments,
    };
  }

  /**
   * Syncs Facebook Page feed and comments (skipping page's own replies)
   */
  private static async syncFacebookPageComments(profile: any, acc: any): Promise<number> {
    const pageId = String(acc.external_account_id);
    const token = acc.access_token;
    const pageName = (acc.account_name || '').trim().toLowerCase();
    let newCount = 0;

    // Fetch up to 10 latest posts with up to 25 latest comments each (with from{id,name})
    const url = `https://graph.facebook.com/v20.0/${pageId}/feed?fields=id,message,created_time,comments.limit(25){id,message,from{id,name},created_time}&limit=10&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json() as any;

    if (!data.data || !Array.isArray(data.data)) {
      if (data.error) throw new Error(data.error.message);
      return 0;
    }

    for (const post of data.data) {
      const commentsList = post.comments?.data || [];
      const postSnippet = (post.message || 'Post Facebook').slice(0, 150);

      for (const c of commentsList) {
        const commentId = String(c.id);
        const commentText = c.message;
        if (!commentText) continue;

        const authorId = c.from?.id ? String(c.from.id) : '';
        const authorName = (c.from?.name || '').trim();

        // 1. FILTER OUT OWN COMMENTS: Do not ingest comments posted by the page itself
        const isOwnComment = (authorId && (authorId === pageId || authorId === String(acc.external_account_id))) ||
                             (authorName && pageName && authorName.toLowerCase() === pageName);
        if (isOwnComment) {
          continue; // Skip self comments!
        }

        // 2. Check if comment already exists in database
        const existing = await dbRepository.findCommentByPlatformCommentId(commentId);
        if (existing) continue;

        // Display real human name instead of raw numerical fb_id
        const finalAuthorName = authorName || (authorId ? `Utente Facebook` : 'Utente');
        const finalAuthorUsername = authorName || (authorId ? `utente_${authorId.slice(-6)}` : 'utente_social');

        // 3. Generate AI Reply
        const aiResult = await AIOrchestrator.generateReply({
          profileId: profile.id,
          platform: 'facebook',
          authorUsername: finalAuthorUsername,
          commentText,
        });

        const isAutoPilot = Boolean(profile.auto_pilot_enabled);
        const initialStatus = isAutoPilot ? 'auto_replied' : 'pending';

        // 4. Insert into DB
        const record = await dbRepository.insertComment({
          id: `fb_${commentId}`,
          profile_id: profile.id,
          social_account_id: acc.id,
          platform: 'facebook',
          platform_post_id: post.id,
          platform_comment_id: commentId,
          author_username: finalAuthorUsername,
          author_name: finalAuthorName,
          comment_text: commentText,
          post_snippet: postSnippet,
          proposed_reply: aiResult.proposedReply,
          final_reply: isAutoPilot ? aiResult.proposedReply : '',
          status: initialStatus,
        });

        newCount++;

        // 5. Handle Auto-Pilot or Telegram Approval
        if (isAutoPilot) {
          await MetaPublisherService.publishReply(record.id, aiResult.proposedReply);
          await dbRepository.saveApprovedReply({
            profile_id: profile.id,
            comment_id: record.id,
            platform: 'facebook',
            comment_text: commentText,
            approved_reply: aiResult.proposedReply,
          });
        } else {
          await TelegramBotService.sendCommentNotification(record);
        }
      }
    }

    return newCount;
  }

  /**
   * Syncs Instagram Business media and comments (skipping profile's own replies)
   */
  private static async syncInstagramComments(profile: any, acc: any): Promise<number> {
    const igUserId = String(acc.external_account_id);
    const token = acc.access_token;
    const ownHandle = (acc.account_handle || acc.account_name || '').replace(/^@/, '').toLowerCase().trim();
    let newCount = 0;

    // Fetch up to 10 latest media posts with up to 25 latest comments each
    const url = `https://graph.facebook.com/v20.0/${igUserId}/media?fields=id,caption,timestamp,comments.limit(25){id,text,from{id,username},timestamp}&limit=10&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json() as any;

    if (!data.data || !Array.isArray(data.data)) {
      if (data.error) throw new Error(data.error.message);
      return 0;
    }

    for (const media of data.data) {
      const commentsList = media.comments?.data || [];
      const postSnippet = (media.caption || 'Post Instagram').slice(0, 150);

      for (const c of commentsList) {
        const commentId = String(c.id);
        const commentText = c.text;
        if (!commentText) continue;

        const authorId = c.from?.id ? String(c.from.id) : '';
        const authorUsernameRaw = (c.from?.username || '').trim();

        // 1. FILTER OUT OWN COMMENTS: Do not ingest comments posted by the Instagram account itself
        const isOwnComment = (authorId && (authorId === igUserId || authorId === String(acc.external_account_id))) ||
                             (authorUsernameRaw && ownHandle && authorUsernameRaw.toLowerCase() === ownHandle);
        if (isOwnComment) {
          continue; // Skip self comments!
        }

        // 2. Check if comment already exists
        const existing = await dbRepository.findCommentByPlatformCommentId(commentId);
        if (existing) continue;

        const authorUsername = authorUsernameRaw ? `@${authorUsernameRaw}` : '@utente_instagram';
        const authorName = authorUsernameRaw || 'Utente Instagram';

        // 3. Generate AI Reply
        const aiResult = await AIOrchestrator.generateReply({
          profileId: profile.id,
          platform: 'instagram',
          authorUsername,
          commentText,
        });

        const isAutoPilot = Boolean(profile.auto_pilot_enabled);
        const initialStatus = isAutoPilot ? 'auto_replied' : 'pending';

        // 4. Insert into DB
        const record = await dbRepository.insertComment({
          id: `ig_${commentId}`,
          profile_id: profile.id,
          social_account_id: acc.id,
          platform: 'instagram',
          platform_post_id: media.id,
          platform_comment_id: commentId,
          author_username: authorUsername,
          author_name: authorName,
          comment_text: commentText,
          post_snippet: postSnippet,
          proposed_reply: aiResult.proposedReply,
          final_reply: isAutoPilot ? aiResult.proposedReply : '',
          status: initialStatus,
        });

        newCount++;

        // 5. Handle Auto-Pilot or Telegram Approval
        if (isAutoPilot) {
          await MetaPublisherService.publishReply(record.id, aiResult.proposedReply);
          await dbRepository.saveApprovedReply({
            profile_id: profile.id,
            comment_id: record.id,
            platform: 'instagram',
            comment_text: commentText,
            approved_reply: aiResult.proposedReply,
          });
        } else {
          await TelegramBotService.sendCommentNotification(record);
        }
      }
    }

    return newCount;
  }
}
