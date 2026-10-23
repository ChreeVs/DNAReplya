import { Router, Request, Response } from 'express';
import { LoggerService } from '../../services/logger/index.js';

const router = Router();

// GET /api/logs - Restituisce i log di sistema filtrati e le relative statistiche
router.get('/', (req: Request, res: Response) => {
  try {
    const level = (req.query.level as string) || 'all';
    const source = (req.query.source as string) || 'all';
    const search = (req.query.search as string) || '';
    const limit = parseInt(req.query.limit as string, 10) || 300;

    const logs = LoggerService.getLogs({ level, source, search, limit });
    const stats = LoggerService.getStats();

    res.json({
      success: true,
      logs,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/logs - Svuota lo storico dei log di sistema
router.delete('/', (req: Request, res: Response) => {
  try {
    LoggerService.clearLogs();
    res.json({ success: true, message: 'Log di sistema svuotati con successo' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/logs/test - Aggiunge un log di test (utile per test diagnostici da UI)
router.post('/test', (req: Request, res: Response) => {
  try {
    const level = req.body?.level || 'info';
    const source = req.body?.source || 'System';
    const message = req.body?.message || 'Messaggio di test diagnostico';
    const details = req.body?.details;

    const entry = LoggerService.addEntry({ level, source, message, details });
    res.json({ success: true, entry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
