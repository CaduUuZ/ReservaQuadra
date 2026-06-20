// Instância única (singleton) do PrismaClient para toda a aplicação.
// Criar um client por requisição esgotaria o pool de conexões do Postgres.
import "dotenv/config"; // carrega o .env em runtime (o prisma.config.ts só vale pra CLI)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Prisma 7 usa "driver adapters": a conexão é feita por um adapter (aqui, Postgres),
// e não mais por uma URL passada direto ao client.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
