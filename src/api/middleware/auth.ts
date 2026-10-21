import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/auth/index.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    name: string;
    role: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Accesso negato: effettua il login per accedere allo strumento' });
  }

  const token = authHeader.substring(7).trim();
  const decoded = AuthService.verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ success: false, error: 'Sessione scaduta o non valida: effettua nuovamente il login' });
  }

  req.user = decoded;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin' && !AuthService.isSuperAdmin(req.user?.email || '')) {
      return res.status(403).json({ success: false, error: 'Permessi insufficienti: operazione riservata all\'amministratore' });
    }
    next();
  });
}
