import { MetaSyncService } from '../social/metaSync.js';
import { TikTokSyncService } from '../social/tiktokSync.js';

export class SchedulerService {
  private static cronInterval: NodeJS.Timeout | null = null;
  private static keepAliveInterval: NodeJS.Timeout | null = null;

  // 15 Minutes Sync Cycle (900,000 ms)
  public static readonly SYNC_INTERVAL_MS = 15 * 60 * 1000;
  private static lastSyncTimestamp: number = Date.now();
  private static nextSyncTimestamp: number = Date.now() + SchedulerService.SYNC_INTERVAL_MS;

  /**
   * Returns current sync timing information
   */
  static getSyncStatus() {
    const now = Date.now();
    const remainingMs = Math.max(0, this.nextSyncTimestamp - now);
    return {
      lastSyncAt: new Date(this.lastSyncTimestamp).toISOString(),
      nextSyncAt: new Date(this.nextSyncTimestamp).toISOString(),
      secondsRemaining: Math.ceil(remainingMs / 1000),
      intervalSeconds: Math.floor(this.SYNC_INTERVAL_MS / 1000),
    };
  }

  /**
   * Resets countdown when a manual sync is triggered
   */
  static notifyManualSync(): void {
    this.lastSyncTimestamp = Date.now();
    this.nextSyncTimestamp = Date.now() + this.SYNC_INTERVAL_MS;
  }

  /**
   * Starts the internal background scheduler
   */
  static start(): void {
    console.log('[SchedulerService] Avvio del servizio di monitoraggio automatico commenti (intervallo 15 min) e keep-alive...');

    // 1. Cron check every 15 minutes (Meta + TikTok)
    this.cronInterval = setInterval(async () => {
      console.log(`[SchedulerService] Esecuzione sync periodico commenti (Meta + TikTok)...`);
      this.lastSyncTimestamp = Date.now();
      this.nextSyncTimestamp = Date.now() + this.SYNC_INTERVAL_MS;
      try {
        await MetaSyncService.syncAllProfilesComments();
        await TikTokSyncService.syncAllProfilesComments();
      } catch (err: any) {
        console.error('[SchedulerService Cron Error]', err.message);
      }
    }, this.SYNC_INTERVAL_MS);

    // Run an initial quick sync in background after 20 seconds from server boot
    setTimeout(async () => {
      try {
        console.log('[SchedulerService] Esecuzione sync iniziale commenti...');
        this.lastSyncTimestamp = Date.now();
        this.nextSyncTimestamp = Date.now() + this.SYNC_INTERVAL_MS;
        await MetaSyncService.syncAllProfilesComments();
        await TikTokSyncService.syncAllProfilesComments();
      } catch (err: any) {
        console.warn('[SchedulerService Initial Sync Warning]', err.message);
      }
    }, 20000);

    // 2. Keep-Alive self ping every 10 minutes to prevent Render idle spin-down
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    this.keepAliveInterval = setInterval(async () => {
      const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://dnareplya.onrender.com';
      try {
        const res = await fetch(`${renderUrl}/api/health`);
        if (res.ok) {
          console.log(`[Keep-Alive Ping] Segnale inviato con successo a ${renderUrl} (${new Date().toLocaleTimeString('it-IT')})`);
        }
      } catch {
        // Silent fail
      }
    }, TEN_MINUTES_MS);
  }

  static stop(): void {
    if (this.cronInterval) clearInterval(this.cronInterval);
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
  }
}
