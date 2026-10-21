import { Router, Request, Response } from 'express';
import { dbRepository } from '../../db/index.js';
import { TelegramBotService } from '../../services/telegram/bot.js';

const router = Router();

function maskKey(key?: string): string {
  if (!key || key.length < 8) return '';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// GET current settings (with masked API keys)
router.get('/', (req: Request, res: Response) => {
  try {
    const raw = dbRepository.getSettings();
    const safeSettings = {
      ...raw,
      api_key_openai_masked: maskKey(raw.api_key_openai),
      api_key_gemini_masked: maskKey(raw.api_key_gemini),
      api_key_anthropic_masked: maskKey(raw.api_key_anthropic),
      api_key_groq_masked: maskKey(raw.api_key_groq),
      telegram_bot_token_masked: maskKey(raw.telegram_bot_token),
      has_openai: Boolean(raw.api_key_openai),
      has_gemini: Boolean(raw.api_key_gemini),
      has_anthropic: Boolean(raw.api_key_anthropic),
      has_groq: Boolean(raw.api_key_groq),
      has_telegram: Boolean(raw.telegram_bot_token && raw.telegram_admin_chat_id),
    };
    res.json({ success: true, settings: safeSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST update settings
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const current = dbRepository.getSettings();

    // Preserve existing keys if user leaves them untouched (masked or empty)
    const updates: any = {
      ai_provider: body.ai_provider ?? current.ai_provider,
      ai_model: body.ai_model ?? current.ai_model,
      tone_of_voice: body.tone_of_voice ?? current.tone_of_voice,
      custom_tone_instructions: body.custom_tone_instructions ?? current.custom_tone_instructions,
      max_reply_length: parseInt(body.max_reply_length ?? current.max_reply_length, 10),
      forbidden_words: body.forbidden_words ?? current.forbidden_words,
      business_knowledge: body.business_knowledge ?? current.business_knowledge,
      auto_pilot_enabled: body.auto_pilot_enabled ? 1 : 0,
      auto_pilot_min_confidence: parseFloat(body.auto_pilot_min_confidence ?? current.auto_pilot_min_confidence),
      telegram_admin_chat_id: body.telegram_admin_chat_id ?? current.telegram_admin_chat_id,
    };

    if (body.api_key_openai && !body.api_key_openai.includes('...')) {
      updates.api_key_openai = body.api_key_openai;
    }
    if (body.api_key_gemini && !body.api_key_gemini.includes('...')) {
      updates.api_key_gemini = body.api_key_gemini;
    }
    if (body.api_key_anthropic && !body.api_key_anthropic.includes('...')) {
      updates.api_key_anthropic = body.api_key_anthropic;
    }
    if (body.api_key_groq && !body.api_key_groq.includes('...')) {
      updates.api_key_groq = body.api_key_groq;
    }
    if (body.telegram_bot_token && !body.telegram_bot_token.includes('...')) {
      updates.telegram_bot_token = body.telegram_bot_token;
    }

    const updated = dbRepository.updateSettings(updates);

    // If telegram token updated, trigger polling if active
    if (updates.telegram_bot_token) {
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
    const settings = dbRepository.getSettings();
    const token = req.body.token || settings.telegram_bot_token;
    const chatId = req.body.chatId || settings.telegram_admin_chat_id;

    if (!token || !chatId) {
      return res.status(400).json({ success: false, error: 'Token o Chat ID mancanti' });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🎉 <b>Test Connessione DNAReplya Riuscito!</b>\nIl tuo bot Telegram è collegato e pronto a ricevere le notifiche di approvazione.',
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
