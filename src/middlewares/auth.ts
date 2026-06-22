// Middleware que protege rotas: exige um JWT válido no header Authorization.
// Se OK, injeta req.userId/req.userName/req.userRole; senão, lança 401.
import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors.js";
import { verifyToken } from "../auth/jwt.js";

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Token de autenticação ausente");
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userName = payload.name;
    req.userRole = payload.role;
    next();
  } catch {
    throw new UnauthorizedError("Token inválido ou expirado");
  }
}

// Exige que o usuário tenha um papel específico (ex: EMPRESA). Use DEPOIS do
// authMiddleware. Token antigo (sem role) ou papel errado -> 403.
export function requireRole(role: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.userRole !== role) {
      throw new ForbiddenError(`Ação permitida apenas para contas do tipo ${role}`);
    }
    next();
  };
}
