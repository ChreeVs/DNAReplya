import nodemailer, { Transporter } from 'nodemailer';
import { TelegramBotService } from '../telegram/bot.js';

export class EmailNotificationService {
  private static transporter: Transporter | null = null;

  private static getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      console.log(`[Email] Configurazione transporter SMTP -> ${host}:${port} (utente: ${user})`);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
      });
      return this.transporter;
    } else {
      console.warn(`[Email] SMTP non attivo: parametri mancanti (host: ${Boolean(host)}, user: ${Boolean(user)}, pass: ${Boolean(pass)})`);
    }
    return null;
  }

  /**
   * Notifies Christian Valese about a new registration requesting approval
   */
  static async notifyNewRegistration(data: {
    name: string;
    email: string;
    approvalToken: string;
    baseUrl: string;
  }): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'christian.valese@dnacreativeagency.it';
    const approveUrl = `${data.baseUrl}/api/auth/approve?token=${data.approvalToken}`;
    const rejectUrl = `${data.baseUrl}/api/auth/reject?token=${data.approvalToken}`;

    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║               🔔 NUOVA RICHIESTA DI REGISTRAZIONE UTENTE                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  👤 Nome:       ${data.name}
║  📧 Email:      ${data.email}
║  🔗 Link Approvazione One-Click:
║     ${approveUrl}
╚══════════════════════════════════════════════════════════════════════════════╝
    `);

    // 1. Try sending real email if SMTP is configured
    const transporter = this.getTransporter();
    if (transporter) {
      try {
        const fromAddress = process.env.SMTP_FROM || `"DNAReplya Security" <${process.env.SMTP_USER || adminEmail}>`;
        await transporter.sendMail({
          from: fromAddress,
          to: adminEmail,
          subject: `🔔 Nuova Richiesta Accesso DNAReplya: ${data.name} (${data.email})`,
          html: `
            <div style="font-family: sans-serif; background: #0f1217; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 580px;">
              <h2 style="color: #a3e635; margin-top: 0;">🧬 DNAReplya - Richiesta di Accesso Interno</h2>
              <p>Un nuovo utente si è registrato e richiede l'approvazione per accedere allo strumento interno:</p>
              <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Nome:</strong> ${data.name}</p>
                <p style="margin: 4px 0;"><strong>Email:</strong> ${data.email}</p>
                <p style="margin: 4px 0;"><strong>Data:</strong> ${new Date().toLocaleString('it-IT')}</p>
              </div>
              <p>Clicca sul pulsante qui sotto per approvare l'accesso e abilitare l'utente:</p>
              <div style="margin: 24px 0;">
                <a href="${approveUrl}" style="background: #a3e635; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">
                  ✅ Approva Utente
                </a>
                <a href="${rejectUrl}" style="background: rgba(255,255,255,0.1); color: #f43f5e; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; margin-left: 12px;">
                  ❌ Rifiuta
                </a>
              </div>
              <p style="font-size: 12px; color: #94a3b8;">Questo link è strettamente riservato all'amministratore Christian Valese.</p>
            </div>
          `,
        });
        console.log(`[Email] Notifica inviata con successo a ${adminEmail}`);
      } catch (err: any) {
        console.error(`[Email] Impossibile inviare email SMTP:`, err.message);
      }
    }

    // 2. Also send Telegram Notification to Christian with 1-click Approval button!
    try {
      const { token, chatId } = await TelegramBotService.getTelegramCredentials();
      if (token && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `
🔔 <b>Richiesta Accesso Utente DNAReplya</b>

👤 <b>Nome:</b> ${data.name}
📧 <b>Email:</b> <code>${data.email}</code>

Vuoi approvare l'accesso di questo collaboratore all'uso interno?
            `.trim(),
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🟢 Approva Utente', url: approveUrl },
                  { text: '❌ Rifiuta', url: rejectUrl },
                ],
              ],
            },
          }),
        });
      }
    } catch (e: any) {
      // Ignore telegram notification failure
    }
  }
}
