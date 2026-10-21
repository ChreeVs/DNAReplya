import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';
import { AuthService } from '../../services/auth/index.js';
import { EmailNotificationService } from '../../services/email/index.js';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// POST Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Tutti i campi (nome, email, password) sono obbligatori' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'La password deve contenere almeno 6 caratteri' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await dbRepository.getUserByEmail(cleanEmail);

    if (existing) {
      if (existing.is_approved) {
        return res.status(400).json({ success: false, error: 'Questa email è già registrata. Effettua il login.' });
      } else {
        return res.status(403).json({
          success: false,
          error: 'Account già registrato. La richiesta è in attesa di approvazione.',
        });
      }
    }

    const { hash, salt } = AuthService.hashPassword(password);
    const isSuperAdmin = AuthService.isSuperAdmin(cleanEmail);
    const approvalToken = AuthService.generateApprovalToken();

    // If Christian registers, automatically approve as Super Admin!
    const isApproved = isSuperAdmin ? 1 : 0;
    const role = isSuperAdmin ? 'admin' : 'member';

    const newUser = await dbRepository.createUser({
      name,
      email: cleanEmail,
      password_hash: hash,
      salt,
      role,
      is_approved: isApproved,
      approval_token: approvalToken,
    });

    if (isApproved) {
      const token = AuthService.createToken(newUser);
      return res.json({
        success: true,
        message: 'Benvenuto Christian! Accesso Super Admin attivato.',
        token,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      });
    }

    // Trigger Notification to Christian Valese via Email & Telegram!
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    try {
      await EmailNotificationService.notifyNewRegistration({
        name: newUser.name,
        email: newUser.email,
        approvalToken,
        baseUrl,
      });
    } catch (notifyErr: any) {
      console.error('[Registration Notification Error]', notifyErr);
    }

    return res.json({
      success: true,
      pendingApproval: true,
      message: 'Registrazione completata! La richiesta è stata inviata: attendi l\'approvazione per poter accedere.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e password sono obbligatori' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await dbRepository.getUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenziali non valide o utente inesistente' });
    }

    const isValid = AuthService.verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Password errata' });
    }

    if (!user.is_approved) {
      return res.status(403).json({
        success: false,
        pendingApproval: true,
        error: 'Il tuo account è in attesa di approvazione. Potrai effettuare l\'accesso non appena la richiesta sarà approvata.',
      });
    }

    const token = AuthService.createToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET One-Click Approval Link (from Email / Telegram)
router.get('/approve', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).send('Token di approvazione mancante.');
    }

    const user = await dbRepository.getUserByApprovalToken(token);
    if (!user) {
      return res.status(404).send('Richiesta non trovata o token scaduto/già utilizzato.');
    }

    await dbRepository.approveUser(user.id);

    // Return a modern HTML page confirming approval
    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>Accesso Approvato | DNAReplya</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Plus Jakarta Sans', sans-serif; background: #090b0e; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #12151b; border: 1px solid #a3e635; padding: 2.5rem; border-radius: 18px; max-width: 480px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
          h2 { color: #a3e635; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; }
          .btn { background: #a3e635; color: #000; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ Utente Abilitato!</h2>
          <p>L'accesso per <b>${user.name}</b> (<code>${user.email}</code>) è stato approvato con successo.</p>
          <p>Ora l'utente può effettuare il login ed accedere allo strumento interno DNAReplya.</p>
          <a href="/" class="btn">Vai alla Dashboard</a>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send('Errore durante l\'approvazione: ' + err.message);
  }
});

// GET One-Click Reject Link
router.get('/reject', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.status(400).send('Token mancante.');

    const user = await dbRepository.getUserByApprovalToken(token);
    if (!user) return res.status(404).send('Richiesta non trovata.');

    await dbRepository.rejectUser(user.id);
    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>Richiesta Rifiutata | DNAReplya</title>
        <style>
          body { font-family: sans-serif; background: #090b0e; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #12151b; border: 1px solid #f43f5e; padding: 2rem; border-radius: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="color:#f43f5e">❌ Richiesta Rifiutata</h2>
          <p>La richiesta per <b>${user.email}</b> è stata rifiutata e rimossa.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send('Errore: ' + err.message);
  }
});

// GET Current User (Protected)
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

// GET Pending Users for Admin Review (Protected Admin)
router.get('/pending-users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pending = await dbRepository.getPendingUsers();
    res.json({ success: true, users: pending });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Approve user manually from dashboard (Protected Admin)
router.post('/approve-user/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approved = await dbRepository.approveUser(String(req.params.id));
    res.json({ success: true, message: 'Utente approvato', user: approved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Reject user manually from dashboard (Protected Admin)
router.post('/reject-user/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await dbRepository.rejectUser(String(req.params.id));
    res.json({ success: true, message: 'Utente rifiutato e rimosso' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
