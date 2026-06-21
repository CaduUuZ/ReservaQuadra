// Geração e validação dos JWTs. Lê o segredo de process.env em tempo de
// execução (não no topo do módulo) pra garantir que o .env já foi carregado.
import jwt from "jsonwebtoken";

export interface TokenPayload {
  sub: string; // id do usuário
  name: string; // nome (conveniência pra UI)
}

const EXPIRES_IN = "7d";

function secret(): string {
  return process.env.JWT_SECRET ?? "dev-secret-inseguro";
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, secret()) as TokenPayload;
}
