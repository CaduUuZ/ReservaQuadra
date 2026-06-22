// Regra de negócio da autenticação: registro e login.
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { ConflictError, UnauthorizedError } from "../errors.js";
import { signToken } from "../auth/jwt.js";
import type { Role, User } from "../generated/prisma/client.js";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: Role; // JOGADOR (padrão) ou EMPRESA
}

interface LoginInput {
  email: string;
  password: string;
}

// Resposta de auth: o token + os dados públicos do usuário (NUNCA a senha).
function buildAuthResponse(user: User) {
  const token = signToken({ sub: user.id, name: user.name, role: user.role });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("E-mail já cadastrado");

  // bcrypt.hash gera um hash com "salt" embutido — o mesmo texto vira hashes
  // diferentes a cada vez, e o original é irrecuperável.
  const password = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, password, role: input.role ?? "JOGADOR" },
  });
  return buildAuthResponse(user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Mensagem genérica (não revela se o e-mail existe) — boa prática de segurança.
  if (!user) throw new UnauthorizedError("E-mail ou senha inválidos");

  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) throw new UnauthorizedError("E-mail ou senha inválidos");

  return buildAuthResponse(user);
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError("Usuário não encontrado");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
