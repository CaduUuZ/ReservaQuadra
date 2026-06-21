// Middleware que protege rotas: exige um JWT válido no header Authorization.
// Se OK, injeta req.userId/req.userName; senão, lança 401.
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors.js";
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
    next();
  } catch {
    throw new UnauthorizedError("Token inválido ou expirado");
  }
}
