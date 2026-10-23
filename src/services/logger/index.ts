export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  source: 'MetaSync' | 'TikTok' | 'AI' | 'Publisher' | 'Telegram' | 'API' | 'Database' | 'System';
  message: string;
  details?: any;
}

export interface LogFilters {
  level?: string;
  source?: string;
  search?: string;
  limit?: number;
}

export class LoggerService {
  private static logs: SystemLogEntry[] = [];
  private static readonly MAX_LOGS = 1000;
  private static initialized = false;

  private static originalConsoleLog = console.log;
  private static originalConsoleWarn = console.warn;
  private static originalConsoleError = console.error;

  /**
   * Initialize console hooks to automatically capture existing console messages
   */
  static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Log startup
    this.info('System', 'Inizializzazione Logger di Sistema DNAReplya completata');

    // Hook console.error
    console.error = (...args: any[]) => {
      this.originalConsoleError(...args);
      try {
        const { message, source, details } = this.formatConsoleArgs(args);
        this.addEntry({
          level: 'error',
          source,
          message,
          details,
        });
      } catch {
        // Never crash on logging
      }
    };

    // Hook console.warn
    console.warn = (...args: any[]) => {
      this.originalConsoleWarn(...args);
      try {
        const { message, source, details } = this.formatConsoleArgs(args);
        this.addEntry({
          level: 'warn',
          source,
          message,
          details,
        });
      } catch {
        // Never crash on logging
      }
    };

    // Hook console.log selectively (only for tagged messages to avoid clutter)
    console.log = (...args: any[]) => {
      this.originalConsoleLog(...args);
      try {
        const first = String(args[0] || '');
        if (
          first.includes('[MetaSync') ||
          first.includes('[TikTok') ||
          first.includes('[AI') ||
          first.includes('[Telegram') ||
          first.includes('[Database') ||
          first.includes('[External Cron') ||
          first.includes('[Comments Route') ||
          first.includes('[Facebook Name') ||
          first.startsWith('✅') ||
          first.startsWith('❌')
        ) {
          const { message, source, details } = this.formatConsoleArgs(args);
          const level = first.startsWith('❌') ? 'error' : (first.startsWith('✅') ? 'success' : 'info');
          this.addEntry({
            level,
            source,
            message,
            details,
          });
        }
      } catch {
        // Never crash on logging
      }
    };
  }

  private static formatConsoleArgs(args: any[]): { message: string; source: SystemLogEntry['source']; details?: any } {
    const rawMsg = args
      .map(a => (typeof a === 'object' && a !== null ? (a.message || JSON.stringify(a)) : String(a)))
      .join(' ')
      .trim();

    let source: SystemLogEntry['source'] = 'System';
    if (/\[MetaSync|MetaPublisher|Facebook|Instagram\]/i.test(rawMsg)) {
      source = 'MetaSync';
    } else if (/\[TikTok|TikTokSync|TikTokPublisher\]/i.test(rawMsg)) {
      source = 'TikTok';
    } else if (/\[AI|AIOrchestrator|OpenAI|Anthropic|Gemini\]/i.test(rawMsg)) {
      source = 'AI';
    } else if (/\[Telegram|Bot\]/i.test(rawMsg)) {
      source = 'Telegram';
    } else if (/\[Publisher|MetaPublisher|TikTokPublisher\]/i.test(rawMsg)) {
      source = 'Publisher';
    } else if (/\[Database|LibSQL|SQLite\]/i.test(rawMsg)) {
      source = 'Database';
    } else if (/\[API|Auth|Comments Route|External Cron\]/i.test(rawMsg)) {
      source = 'API';
    }

    let details: any = undefined;
    if (args.length > 1) {
      details = args.slice(1).map(a => (typeof a === 'object' && a !== null ? a : String(a)));
      if (details.length === 1) details = details[0];
    } else if (args[0] instanceof Error) {
      details = {
        name: args[0].name,
        message: args[0].message,
        stack: args[0].stack,
      };
    }

    return { message: rawMsg, source, details };
  }

  static addEntry(entry: Omit<SystemLogEntry, 'id' | 'timestamp'>): SystemLogEntry {
    const newEntry: SystemLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level: entry.level,
      source: entry.source,
      message: entry.message,
      details: entry.details,
    };

    this.logs.unshift(newEntry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.length = this.MAX_LOGS;
    }
    return newEntry;
  }

  static info(source: SystemLogEntry['source'], message: string, details?: any): SystemLogEntry {
    return this.addEntry({ level: 'info', source, message, details });
  }

  static success(source: SystemLogEntry['source'], message: string, details?: any): SystemLogEntry {
    return this.addEntry({ level: 'success', source, message, details });
  }

  static warn(source: SystemLogEntry['source'], message: string, details?: any): SystemLogEntry {
    return this.addEntry({ level: 'warn', source, message, details });
  }

  static error(source: SystemLogEntry['source'], message: string, details?: any): SystemLogEntry {
    return this.addEntry({ level: 'error', source, message, details });
  }

  static getLogs(filters?: LogFilters): SystemLogEntry[] {
    let result = [...this.logs];

    if (filters?.level && filters.level !== 'all') {
      result = result.filter(l => l.level === filters.level);
    }

    if (filters?.source && filters.source !== 'all') {
      result = result.filter(l => l.source.toLowerCase() === filters.source!.toLowerCase());
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(l =>
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
      );
    }

    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 300;
    return result.slice(0, limit);
  }

  static clearLogs(): void {
    this.logs = [];
    this.info('System', 'Log di sistema svuotati manualmente');
  }

  static getStats(): {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    success: number;
    lastLogTime?: string;
  } {
    let errors = 0;
    let warnings = 0;
    let info = 0;
    let success = 0;

    for (const l of this.logs) {
      if (l.level === 'error') errors++;
      else if (l.level === 'warn') warnings++;
      else if (l.level === 'success') success++;
      else info++;
    }

    return {
      total: this.logs.length,
      errors,
      warnings,
      info,
      success,
      lastLogTime: this.logs[0]?.timestamp,
    };
  }
}
