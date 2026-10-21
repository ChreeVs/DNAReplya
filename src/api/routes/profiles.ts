import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';

const router = Router();

// GET all profiles
router.get('/', async (req: Request, res: Response) => {
  try {
    const profiles = await dbRepository.getAllProfiles();
    const enriched = await Promise.all(
      profiles.map(async (p) => {
        const accounts = await dbRepository.getSocialAccountsByProfile(p.id);
        const comments = await dbRepository.getCommentsByProfile(p.id, 100);
        return {
          ...p,
          accountsCount: accounts.length,
          pendingCommentsCount: comments.filter(c => c.status === 'pending').length,
          totalCommentsCount: comments.length,
        };
      })
    );
    res.json({ success: true, profiles: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create a new profile (with color and logo_url)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, color, logo_url, tone_of_voice, business_knowledge } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Il nome del profilo è obbligatorio' });
    }

    const newProfile = await dbRepository.createProfile({
      name: name.trim(),
      description: description || '',
      color: color || '#a3e635',
      logo_url: logo_url || '',
      tone_of_voice: tone_of_voice || 'friendly',
      business_knowledge: business_knowledge || '',
    });

    res.json({ success: true, profile: newProfile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single profile by ID with its connected social accounts
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const profile = await dbRepository.getProfileById(String(req.params.id));
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profilo non trovato' });
    }
    const accounts = await dbRepository.getSocialAccountsByProfile(profile.id);
    res.json({ success: true, profile, accounts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update profile guardrails, knowledge, color and logo_url
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.id);
    const existing = await dbRepository.getProfileById(profileId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Profilo non trovato' });
    }

    const updated = await dbRepository.updateProfile(profileId, req.body);
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE profile
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.id);
    await dbRepository.deleteProfile(profileId);
    res.json({ success: true, message: 'Profilo eliminato' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET social accounts for a profile
router.get('/:id/accounts', async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.id);
    const accounts = await dbRepository.getSocialAccountsByProfile(profileId);
    res.json({ success: true, accounts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add a social account to a profile
router.post('/:id/accounts', async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.id);
    const { platform, account_name, account_handle, external_account_id, access_token, notes } = req.body;

    if (!platform || !account_name || !account_handle) {
      return res.status(400).json({ success: false, error: 'Piattaforma, nome account e handle sono obbligatori' });
    }

    const newAccount = await dbRepository.createSocialAccount({
      profile_id: profileId,
      platform,
      account_name,
      account_handle,
      external_account_id,
      access_token,
      notes,
    });

    res.json({ success: true, account: newAccount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE a social account
router.delete('/:id/accounts/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = String(req.params.accountId);
    await dbRepository.deleteSocialAccount(accountId);
    res.json({ success: true, message: 'Account social disconnesso' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
