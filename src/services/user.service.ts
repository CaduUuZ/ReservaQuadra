// Regra de negócio de usuários. Por ora, só listagem (pro frontend escolher
// "quem sou eu" no demo). Criar usuário fica como evolução futura.
import { prisma } from "../db/prisma.js";

export async function listUsers() {
  return prisma.user.findMany({ orderBy: { name: "asc" } });
}
