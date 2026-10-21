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

// 1. Initialize SQLite Database & default profiles
initDatabase();
console.log('✅ [Database] SQLite multi-profilo inizializzato su:', config.databasePath);

// 2. Initialize Express App
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Serve Frontend Dashboard Static Files
const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

// 4. API Routes
app.use('/api/profiles', profilesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/webhooks', webhooksRouter);

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  const globalSettings = dbRepository.getGlobalSettings();
  const profiles = dbRepository.getAllProfiles();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    profilesCount: profiles.length,
    defaultAIProvider: globalSettings.default_ai_provider,
    telegramConfigured: Boolean(globalSettings.global_telegram_bot_token),
  });
});

// Fallback to index.html for dashboard SPA routing
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint non trovato' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 5. Start Server
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nArresto in corso...');
  TelegramBotService.stopPolling();
  server.close(() => {
    console.log('Server chiuso.');
    process.exit(0);
  });
});
