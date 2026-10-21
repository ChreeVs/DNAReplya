import { MetaSyncService } from '../social/metaSync.js';

export class SchedulerService {
  private static cronInterval: NodeJS.Timeout | null = null;
  private static keepAliveInterval: NodeJS.Timeout | null = null;

  /**
   * Starts the internal background scheduler
   */
  static start(): void {
    console.log('[SchedulerService] Avvio del servizio di monitoraggio automatico commenti e keep-alive...');

    // 1. Cron check every 3 hours (3 * 60 * 60 * 1000 ms)
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    this.cronInterval = setInterval(async () => {
      console.log(`[SchedulerService] Esecuzione sync periodico commenti (intervallo 3 ore)...`);
      try {
        await MetaSyncService.syncAllProfilesComments();
      } catch (err: any) {
        console.error('[SchedulerService Cron Error]', err.message);
      }
    }, THREE_HOURS_MS);

    // Run an initial quick sync in background after 30 seconds from server boot
    setTimeout(async () => {
      try {
        console.log('[SchedulerService] Esecuzione sync iniziale commenti...');
        await MetaSyncService.syncAllProfilesComments();
      } catch (err: any) {
        console.warn('[SchedulerService Initial Sync Warning]', err.message);
      }
    }, 30000);

    // 2. Keep-Alive self ping every 10 minutes (10 * 60 * 1000 ms) to keep Render awake
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    this.keepAliveInterval = setInterval(async () => {
      const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://dnareplya.onrender.com';
      try {
        const res = await fetch(`${renderUrl}/api/health`);
        if (res.ok) {
          console.log(`[Keep-Alive Ping] Segnale inviato con successo a ${renderUrl} (${new Date().toLocaleTimeString('it-IT')})`);
        }
      } catch (err: any) {
        // Silent fail on local dev or temporary network hiccup
      }
    }, TEN_MINUTES_MS);
  }

  static stop(): void {
    if (this.cronInterval) clearInterval(this.cronInterval);
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
  }
}
