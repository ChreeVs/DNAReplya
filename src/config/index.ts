import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'dnareplya.db'),
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
  },
  meta: {
    appId: process.env.META_APP_ID || '1064485339977852',
    appSecret: process.env.META_APP_SECRET || '',
    verifyToken: process.env.META_VERIFY_TOKEN || 'dnareplya_meta_verify_token_secure',
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || '',
  },
};
