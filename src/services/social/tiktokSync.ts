import { dbRepository, ProfileRecord, SocialAccountRecord } from '../../db/index.js';
import { AIOrchestrator } from '../ai/orchestrator.js';
import { TelegramBotService } from '../telegram/bot.js';
import { TikTokPublisherService } from './tiktokPublisher.js';

export class TikTokSyncService {
  /**
   * Syncs comments for a specific profile from all connected TikTok accounts
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
    const activeTikTokAccounts = accounts.filter(
      a => a.platform.toLowerCase() === 'tiktok' && a.access_token
    );

    let checkedAccounts = 0;
    let newCommentsFound = 0;
    const errors: string[] = [];

    for (const acc of activeTikTokAccounts) {
      try {
        checkedAccounts++;
        const count = await this.syncTikTokAccountComments(profile, acc);
        newCommentsFound += count;
      } catch (err: any) {
        console.error(`[TikTokSync] Errore sync account ${acc.account_name} (tiktok):`, err.message);
        errors.push(`${acc.account_name}: ${err.message}`);
      }
    }

    return { checkedAccounts, newCommentsFound, errors };
  }

  /**
   * Syncs comments across ALL active profiles for TikTok
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
      try {
        const res = await this.syncCommentsForProfile(p.id);
        totalAccounts += res.checkedAccounts;
        totalNewComments += res.newCommentsFound;
      } catch (err: any) {
        console.error(`[TikTokSync] Errore sync profilo ${p.name}:`, err.message);
      }
    }

    return {
      totalProfiles: profiles.length,
      totalAccounts,
      totalNewComments,
    };
  }

  /**
   * Fetches recent videos and comments from TikTok Business API
   */
  private static async syncTikTokAccountComments(
    profile: ProfileRecord,
    acc: SocialAccountRecord
  ): Promise<number> {
    const accessToken = acc.access_token.trim();
    const businessId = acc.external_account_id?.trim() || '';
    const accountHandle = (acc.account_handle || '').replace(/^@/, '').toLowerCase().trim();
    let newCount = 0;

    console.log(`[TikTokSync] Controllo nuovi commenti per @${acc.account_handle} (${acc.account_name})...`);

    // 1. Fetch recent videos owned by the Business Account
    // Endpoint: GET /open_api/v1.3/business/video/list/
    const videoListUrl = new URL('https://business-api.tiktok.com/open_api/v1.3/business/video/list/');
    if (businessId) {
      videoListUrl.searchParams.append('business_id', businessId);
    }
    videoListUrl.searchParams.append('max_count', '10');

    let videoItems: Array<{ item_id: string; title?: string }> = [];

    try {
      const vRes = await fetch(videoListUrl.toString(), {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (vRes.ok) {
        const vData = (await vRes.json()) as any;
        if (vData.code === 0 && vData.data?.videos) {
          videoItems = vData.data.videos.map((v: any) => ({
            item_id: String(v.item_id || v.video_id || v.id),
            title: v.title || v.video_description || 'Video TikTok',
          }));
        }
      }
    } catch (vErr: any) {
      console.warn(`[TikTokSync] Impossibile recuperare video list per ${acc.account_name}:`, vErr.message);
    }

    // 2. Fetch comments for each video
    for (const vid of videoItems) {
      if (!vid.item_id) continue;

      const commentListUrl = new URL('https://business-api.tiktok.com/open_api/v1.3/business/comment/list/');
      if (businessId) {
        commentListUrl.searchParams.append('business_id', businessId);
      }
      commentListUrl.searchParams.append('video_id', vid.item_id);
      commentListUrl.searchParams.append('page_size', '20');

      try {
        const cRes = await fetch(commentListUrl.toString(), {
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!cRes.ok) continue;

        const cData = (await cRes.json()) as any;
        if (cData.code !== 0 || !cData.data?.comments) continue;

        const comments = cData.data.comments;
        for (const c of comments) {
          const commentId = String(c.comment_id || c.id);
          const commentText = c.text || '';
          if (!commentText) continue;

          const authorUsername = (c.user_name || c.unique_id || 'utente_tiktok').replace(/^@/, '');
          const authorName = c.display_name || authorUsername || 'Utente TikTok';

          // Filter out own comments from the business profile itself
          if (authorUsername && accountHandle && authorUsername.toLowerCase() === accountHandle) {
            continue;
          }

          // Check if comment was previously deleted or already exists in database
          const isDeleted = await dbRepository.isPlatformCommentDeleted(commentId) || await dbRepository.isPlatformCommentDeleted(`tt_${commentId}`);
          if (isDeleted) continue;

          const existing = await dbRepository.findCommentByPlatformCommentId(commentId);
          if (existing) continue;

          // 3. Generate AI Reply
          const aiResult = await AIOrchestrator.generateReply({
            profileId: profile.id,
            platform: 'tiktok',
            authorUsername,
            commentText,
            postSnippet: vid.title,
          });

          const isAutoPilot = Boolean(profile.auto_pilot_enabled);
          const initialStatus = isAutoPilot ? 'auto_replied' : 'pending';

          // 4. Insert into DB
          const record = await dbRepository.insertComment({
            id: `tt_${commentId}`,
            profile_id: profile.id,
            social_account_id: acc.id,
            platform: 'tiktok',
            platform_post_id: vid.item_id,
            platform_comment_id: commentId,
            author_username: authorUsername,
            author_name: authorName,
            comment_text: commentText,
            post_snippet: vid.title,
            proposed_reply: aiResult.proposedReply,
            final_reply: isAutoPilot ? aiResult.proposedReply : '',
            status: initialStatus,
          });

          newCount++;

          // 5. Handle Auto-Pilot or Telegram Notification
          if (isAutoPilot) {
            await TikTokPublisherService.publishReply(record.id, aiResult.proposedReply);
            await dbRepository.saveApprovedReply({
              profile_id: profile.id,
              comment_id: record.id,
              platform: 'tiktok',
              comment_text: commentText,
              approved_reply: aiResult.proposedReply,
            });
          } else {
            const tgMsgId = await TelegramBotService.sendCommentNotification(record);
            if (tgMsgId) {
              await dbRepository.updateComment(record.id, {
                telegram_message_id: tgMsgId,
              });
            }
          }
        }
      } catch (cErr: any) {
        console.warn(`[TikTokSync] Errore recupero commenti per video ${vid.item_id}:`, cErr.message);
      }
    }

    return newCount;
  }
}
