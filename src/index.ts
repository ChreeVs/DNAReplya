import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { initDatabase, dbRepository } from './db/index.js';
import { TelegramBotService } from './services/telegram/bot.js';

import profilesRouter from './api/routes/profiles.js';
import settingsRouter from './api/routes/settings.js';
import commentsRouter from './api/routes/comments.js';
import webhooksRouter from './api/routes/webhooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

app.use('/api/profiles', profilesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/webhooks', webhooksRouter);

// Healthcheck endpoint
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

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint non trovato' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start Server after DB initialization
async function start() {
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
  });

  process.on('SIGINT', () => {
    console.log('\nArresto in corso...');
    TelegramBotService.stopPolling();
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
