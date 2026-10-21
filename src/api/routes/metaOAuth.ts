import { Router, Request, Response } from 'express';
import { config } from '../../config/index.js';
import { dbRepository } from '../../db/index.js';

const router = Router();

/**
 * Initiates Login with Facebook for Business flow
 */
router.get('/facebook', (req: Request, res: Response) => {
  const profileId = (req.query.profileId as string) || '';
  if (!profileId) {
    return res.status(400).send('Profile ID mancante.');
  }

  const appId = config.meta.appId;
  if (!appId) {
    return res.status(500).send('META_APP_ID non configurato nel server.');
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host') || 'localhost:3000';
  const redirectUri = `${protocol}://${host}/api/auth/facebook/callback`;

  const statePayload = {
    profileId,
    timestamp: Date.now(),
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_engagement',
    'instagram_basic',
    'instagram_manage_comments',
    'business_management',
  ].join(',');

  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scopes}&response_type=code`;

  res.redirect(authUrl);
});

/**
 * OAuth Callback from Facebook
 */
router.get('/facebook/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('[Facebook OAuth Error]', error, error_description);
      return res.redirect(`/?fb_error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || !state) {
      return res.status(400).send('Parametri di autorizzazione mancanti.');
    }

    let profileId = '';
    try {
      const decodedState = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
      profileId = decodedState.profileId;
    } catch {
      return res.status(400).send('Stato di sicurezza non valido.');
    }

    const appId = config.meta.appId;
    const appSecret = config.meta.appSecret;

    if (!appId || !appSecret) {
      return res.status(500).send('META_APP_ID o META_APP_SECRET mancanti nelle variabili d\'ambiente del server.');
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/auth/facebook/callback`;

    // 1. Exchange authorization code for User Access Token
    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json() as any;

    if (!tokenData.access_token) {
      console.error('[Facebook Token Exchange Failed]', tokenData);
      return res.redirect(`/?fb_error=${encodeURIComponent(tokenData.error?.message || 'Scambio token fallito')}`);
    }

    let userAccessToken = tokenData.access_token;

    // 2. Exchange for Long-Lived User Access Token (valid for 60 days)
    try {
      const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userAccessToken}`;
      const longLivedRes = await fetch(longLivedUrl);
      const longLivedData = await longLivedRes.json() as any;
      if (longLivedData.access_token) {
        userAccessToken = longLivedData.access_token;
      }
    } catch (e) {
      console.warn('[Facebook Long Lived Token Warning]', e);
    }

    // 3. Fetch user's managed Facebook Pages and linked Instagram accounts
    const accountsUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${userAccessToken}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json() as any;

    if (!accountsData.data || !Array.isArray(accountsData.data)) {
      console.error('[Facebook Accounts Failed]', accountsData);
      return res.redirect(`/?fb_error=${encodeURIComponent(accountsData.error?.message || 'Nessuna pagina trovata')}`);
    }

    let connectedCount = 0;

    for (const page of accountsData.data) {
      // Connect Facebook Page
      await dbRepository.upsertSocialAccount({
        profile_id: profileId,
        platform: 'facebook',
        account_name: page.name,
        account_handle: page.name,
        external_account_id: page.id,
        access_token: page.access_token,
        notes: `Pagina Facebook collegata via Login with Facebook (${new Date().toLocaleDateString('it-IT')})`,
      });
      connectedCount++;

      // Programmatically subscribe page to app webhooks for feed and comments!
      try {
        await fetch(`https://graph.facebook.com/v20.0/${page.id}/subscribed_apps?subscribed_fields=feed&access_token=${page.access_token}`, {
          method: 'POST',
        });
      } catch (subErr) {
        console.warn(`[Webhook Subscribe Warning for ${page.name}]`, subErr);
      }

      // If page has a linked Instagram Business Account, connect Instagram too!
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account;
        await dbRepository.upsertSocialAccount({
          profile_id: profileId,
          platform: 'instagram',
          account_name: ig.name || ig.username || page.name,
          account_handle: ig.username ? `@${ig.username}` : `@${page.name}`,
          external_account_id: ig.id,
          access_token: page.access_token, // Page access token manages the connected Instagram account
          notes: `Account Instagram collegato via Login with Facebook (${new Date().toLocaleDateString('it-IT')})`,
        });
        connectedCount++;

        // Subscribe Instagram to webhooks
        try {
          await fetch(`https://graph.facebook.com/v20.0/${page.id}/subscribed_apps?subscribed_fields=feed,comments&access_token=${page.access_token}`, {
            method: 'POST',
          });
        } catch (igSubErr) {
          console.warn(`[Instagram Webhook Subscribe Warning for ${ig.username}]`, igSubErr);
        }
      }
    }

    return res.redirect(`/?fb_connected=success&count=${connectedCount}`);
  } catch (err: any) {
    console.error('[Facebook Callback Exception]', err);
    return res.redirect(`/?fb_error=${encodeURIComponent(err.message || 'Errore durante la connessione')}`);
  }
});

export default router;
