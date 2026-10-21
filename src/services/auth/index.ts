import crypto from 'crypto';
import { UserRecord } from '../../db/index.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'dnareplya_secure_session_secret_2026_xyz';
const SUPER_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'christian.valese@dnacreativeagency.it';

export class AuthService {
  static getSuperAdminEmail(): string {
    return SUPER_ADMIN_EMAIL;
  }

  static isSuperAdmin(email: string): boolean {
    const clean = email.toLowerCase().trim();
    return clean === SUPER_ADMIN_EMAIL.toLowerCase() ||
           clean === 'christian.valese@dnacreativeagency.it' ||
           clean === 'christian.valese@dnacreativeagecy.it';
  }

  static hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  }

  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }

  static generateApprovalToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a signed tamper-proof session token valid for 7 days
   */
  static createToken(user: UserRecord): string {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const headerBase64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url');

    return `${headerBase64}.${payloadBase64}.${signature}`;
  }

  /**
   * Verifies and decodes a session token
   */
  static verifyToken(token: string): { sub: string; email: string; name: string; role: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, payload, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', AUTH_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      if (decoded.exp && decoded.exp < Date.now()) {
        return null; // Expired
      }

      return decoded;
    } catch (e) {
      return null;
    }
  }
}
