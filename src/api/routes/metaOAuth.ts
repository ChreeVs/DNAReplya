import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import { dbRepository } from '../../db/index.js';

const router = Router();

interface DiscoveredPage {
  id: string;
  name: string;
  accessToken: string;
  category?: string;
  instagram?: {
    id: string;
    username: string;
    name?: string;
  };
}

interface PendingOAuthSession {
  profileId: string;
  profileName: string;
  pages: DiscoveredPage[];
  createdAt: number;
}

// Temporary store for pending channel selection (expires after 15 min)
const pendingSessions = new Map<string, PendingOAuthSession>();

// Cleanup expired sessions every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingSessions.entries()) {
    if (now - session.createdAt > 15 * 60 * 1000) {
      pendingSessions.delete(key);
    }
  }
}, 10 * 60 * 1000);

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
    'pages_read_user_content',
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
    const accountsUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,category,access_token,instagram_business_account{id,username,name}&access_token=${userAccessToken}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json() as any;

    if (!accountsData.data || !Array.isArray(accountsData.data) || accountsData.data.length === 0) {
      console.error('[Facebook Accounts Empty]', accountsData);
      return res.redirect(`/?fb_error=${encodeURIComponent('Nessuna pagina Facebook trovata per questo account utente.')}`);
    }

    // Look up profile name for display
    const profile = await dbRepository.getProfileById(profileId);
    const profileName = profile ? profile.name : 'Profilo Cliente';

    const discoveredPages: DiscoveredPage[] = accountsData.data.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      accessToken: p.access_token,
      instagram: p.instagram_business_account ? {
        id: p.instagram_business_account.id,
        username: p.instagram_business_account.username || p.instagram_business_account.name,
        name: p.instagram_business_account.name,
      } : undefined,
    }));

    // Create selection session
    const sessionId = crypto.randomUUID();
    pendingSessions.set(sessionId, {
      profileId,
      profileName,
      pages: discoveredPages,
      createdAt: Date.now(),
    });

    console.log(`[Facebook OAuth] Trovate ${discoveredPages.length} pagine. Creata sessione di selezione ${sessionId} per profilo "${profileName}"`);
    return res.redirect(`/?fb_select_session=${sessionId}`);
  } catch (err: any) {
    console.error('[Facebook Callback Exception]', err);
    return res.redirect(`/?fb_error=${encodeURIComponent(err.message || 'Errore durante la connessione')}`);
  }
});

/**
 * Returns discovered pages and Instagram accounts for an active OAuth selection session
 */
router.get('/facebook/session', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId || !pendingSessions.has(sessionId)) {
    return res.status(404).json({ success: false, error: 'Sessione di selezione scaduta o non valida.' });
  }

  const session = pendingSessions.get(sessionId)!;
  // Return sanitized page & IG info (without exposing raw page access tokens to the browser)
  res.json({
    success: true,
    sessionId,
    profileId: session.profileId,
    profileName: session.profileName,
    pages: session.pages.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      hasInstagram: Boolean(p.instagram),
      instagram: p.instagram ? {
        id: p.instagram.id,
        username: p.instagram.username,
        name: p.instagram.name,
      } : null,
    })),
  });
});

/**
 * Connects ONLY the user-selected Facebook Page and/or Instagram account to the active profile
 */
router.post('/facebook/select', async (req: Request, res: Response) => {
  try {
    const { sessionId, selectedFacebookPageId, selectedInstagramId } = req.body;
    if (!sessionId || !pendingSessions.has(sessionId)) {
      return res.status(400).json({ success: false, error: 'Sessione di connessione scaduta. Riprova il login.' });
    }

    const session = pendingSessions.get(sessionId)!;
    const profileId = session.profileId;
    let connectedCount = 0;

    // 1. Connect selected Facebook Page (if chosen)
    if (selectedFacebookPageId && selectedFacebookPageId !== 'none') {
      const page = session.pages.find(p => p.id === selectedFacebookPageId);
      if (page) {
        await dbRepository.upsertSocialAccount({
          profile_id: profileId,
          platform: 'facebook',
          account_name: page.name,
          account_handle: page.name,
          external_account_id: page.id,
          access_token: page.accessToken,
          notes: `Pagina Facebook collegata via Login with Facebook (${new Date().toLocaleDateString('it-IT')})`,
        });
        connectedCount++;

        // Subscribe to page webhooks
        try {
          await fetch(`https://graph.facebook.com/v20.0/${page.id}/subscribed_apps?subscribed_fields=feed&access_token=${page.accessToken}`, {
            method: 'POST',
          });
        } catch (subErr) {
          console.warn(`[Webhook Subscribe Warning for ${page.name}]`, subErr);
        }
      }
    }

    // 2. Connect selected Instagram Account (if chosen)
    if (selectedInstagramId && selectedInstagramId !== 'none') {
      // Find the page that owns this Instagram account
      const pageWithIg = session.pages.find(p => p.instagram && p.instagram.id === selectedInstagramId);
      if (pageWithIg && pageWithIg.instagram) {
        const ig = pageWithIg.instagram;
        await dbRepository.upsertSocialAccount({
          profile_id: profileId,
          platform: 'instagram',
          account_name: ig.name || ig.username,
          account_handle: ig.username ? `@${ig.username}` : `@${pageWithIg.name}`,
          external_account_id: ig.id,
          access_token: pageWithIg.accessToken, // Page token manages the connected Instagram account
          notes: `Profilo Instagram collegato via Login with Facebook (${new Date().toLocaleDateString('it-IT')})`,
        });
        connectedCount++;

        // Subscribe to Instagram comments webhooks
        try {
          await fetch(`https://graph.facebook.com/v20.0/${pageWithIg.id}/subscribed_apps?subscribed_fields=feed,comments&access_token=${pageWithIg.accessToken}`, {
            method: 'POST',
          });
        } catch (igSubErr) {
          console.warn(`[Instagram Webhook Subscribe Warning for ${ig.username}]`, igSubErr);
        }
      }
    }

    // Clear session
    pendingSessions.delete(sessionId);

    res.json({
      success: true,
      profileId,
      profileName: session.profileName,
      connectedCount,
      message: `Collegati con successo ${connectedCount} canali al profilo "${session.profileName}".`,
    });
  } catch (err: any) {
    console.error('[Facebook Channel Selection Exception]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
