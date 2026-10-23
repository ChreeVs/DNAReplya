import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { initDatabase, dbRepository } from './db/index.js';
import { TelegramBotService } from './services/telegram/bot.js';
import { requireAuth } from './api/middleware/auth.js';

import { SchedulerService } from './services/scheduler/index.js';
import { MetaSyncService } from './services/social/metaSync.js';
import { TikTokSyncService } from './services/social/tiktokSync.js';
import { LoggerService } from './services/logger/index.js';

import authRouter from './api/routes/auth.js';
import profilesRouter from './api/routes/profiles.js';
import settingsRouter from './api/routes/settings.js';
import commentsRouter from './api/routes/comments.js';
import webhooksRouter from './api/routes/webhooks.js';
import metaOAuthRouter from './api/routes/metaOAuth.js';
import logsRouter from './api/routes/logs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir, {
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// Public Auth, Webhooks & Cron Routes
app.use('/api/auth', authRouter);
app.use('/api/auth', metaOAuthRouter);
app.use('/api/webhooks', webhooksRouter);

// Public 3-Hour External Cron / Keep-Alive trigger
app.get('/api/cron/check-comments', async (req, res) => {
  try {
    console.log('[External Cron] Trigger ricevuto per /api/cron/check-comments');
    const metaResult = await MetaSyncService.syncAllProfilesComments();
    const tiktokResult = await TikTokSyncService.syncAllProfilesComments();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      meta: metaResult,
      tiktok: tiktokResult,
      totalNewComments: metaResult.totalNewComments + tiktokResult.totalNewComments,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protected Internal Routes (Requires Auth)
app.use('/api/profiles', requireAuth, profilesRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/comments', requireAuth, commentsRouter);
app.use('/api/logs', requireAuth, logsRouter);

// Healthcheck endpoint (Public)
app.get('/api/health', async (req, res) => {
  try {
    const globalSettings = await dbRepository.getGlobalSettings();
    const profiles = await dbRepository.getAllProfiles();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      profilesCount: profiles.length,
      defaultAIProvider: globalSettings.default_ai_provider,
      telegramConfigured: Boolean(globalSettings.global_telegram_bot_token),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Express global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  LoggerService.error('API', `Errore non gestito su ${req.method} ${req.path}: ${err.message}`, {
    stack: err.stack,
    query: req.query,
  });
  res.status(500).json({ success: false, error: err.message || 'Errore interno del server' });
});

// SPA routing fallback
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint non trovato' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start Server
async function start() {
  LoggerService.init();
  await initDatabase();
  console.log('✅ [Database] LibSQL/SQLite inizializzato con successo.');

  const server = app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║               🧬 DNAReplya Multi-Profilo Hub              ║
║       Social AI Reply & Approval Assistant is RUNNING     ║
╠═══════════════════════════════════════════════════════════╣
║  🌐 Web Dashboard:    http://localhost:${config.port}              ║
║  📡 API Endpoint:     http://localhost:${config.port}/api          ║
║  🩺 Health Check:     http://localhost:${config.port}/api/health   ║
╚═══════════════════════════════════════════════════════════╝
    `);

    TelegramBotService.startPolling();
    SchedulerService.start();
  });

  process.on('SIGINT', () => {
    console.log('\nArresto in corso...');
    TelegramBotService.stopPolling();
    SchedulerService.stop();
    server.close(() => {
      console.log('Server chiuso.');
      process.exit(0);
    });
  });
}

start().catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
