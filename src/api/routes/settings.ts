import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';
import { TelegramBotService } from '../../services/telegram/bot.js';

const router = Router();

function maskKey(key?: string): string {
  if (!key || key.length < 8) return '';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// GET global settings (OpenAI, Gemini, Claude, Telegram)
router.get('/', async (req: Request, res: Response) => {
  try {
    const raw = await dbRepository.getGlobalSettings();
    const safeSettings = {
      default_ai_provider: raw.default_ai_provider || 'openai',
      api_key_openai_masked: maskKey(raw.api_key_openai),
      api_key_gemini_masked: maskKey(raw.api_key_gemini),
      api_key_anthropic_masked: maskKey(raw.api_key_anthropic),
      telegram_bot_token_masked: maskKey(raw.global_telegram_bot_token),
      has_openai: Boolean(raw.api_key_openai),
      has_gemini: Boolean(raw.api_key_gemini),
      has_anthropic: Boolean(raw.api_key_anthropic),
      has_telegram: Boolean(raw.global_telegram_bot_token),
    };
    res.json({ success: true, settings: safeSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST update global BYOK settings
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const current = await dbRepository.getGlobalSettings();

    const updates: any = {
      default_ai_provider: body.default_ai_provider ?? current.default_ai_provider,
    };

    const clean = (val?: string) => (val || '').trim().replace(/^["']|["']$/g, '');

    if (body.api_key_openai && !body.api_key_openai.includes('...')) {
      updates.api_key_openai = clean(body.api_key_openai);
    }
    if (body.api_key_gemini && !body.api_key_gemini.includes('...')) {
      updates.api_key_gemini = clean(body.api_key_gemini);
    }
    if (body.api_key_anthropic && !body.api_key_anthropic.includes('...')) {
      updates.api_key_anthropic = clean(body.api_key_anthropic);
    }
    if (body.global_telegram_bot_token && !body.global_telegram_bot_token.includes('...')) {
      updates.global_telegram_bot_token = clean(body.global_telegram_bot_token);
    }

    const updated = await dbRepository.updateGlobalSettings(updates);

    if (updates.global_telegram_bot_token) {
      TelegramBotService.stopPolling();
      TelegramBotService.startPolling();
    }

    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST test Telegram connection
router.post('/test-telegram', async (req: Request, res: Response) => {
  try {
    const globalSettings = await dbRepository.getGlobalSettings();
    const token = req.body.token || globalSettings.global_telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = req.body.chatId || process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!token || !chatId) {
      return res.status(400).json({ success: false, error: 'Token o Chat ID mancanti' });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🎉 <b>Test Connessione DNAReplya Riuscito!</b>\nIl bot Telegram è pronto per le notifiche e l\'approvazione commenti.',
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json() as any;
    if (data.ok) {
      res.json({ success: true, message: 'Messaggio inviato con successo su Telegram!' });
    } else {
      res.status(400).json({ success: false, error: data.description || 'Errore API Telegram' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
