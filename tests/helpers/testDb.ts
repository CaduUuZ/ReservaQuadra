// Sobe um Postgres descartável (Testcontainers) só pros testes e aplica as
// migrations nele. O container é destruído ao final da suíte.
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";

export async function startTestDatabase() {
  // postgres:16 = mesma imagem do docker-compose (já traz o btree_gist que a
  // migration ativa). Testcontainers escolhe uma porta aleatória livre.
  const container = await new PostgreSqlContainer("postgres:16").start();
  const url = container.getConnectionUri();

  // IMPORTANTE: setamos a DATABASE_URL ANTES de qualquer import do client do
  // Prisma. O singleton (src/db/prisma.ts) lê essa variável ao ser carregado;
  // por isso os testes importam os services DINAMICAMENTE, depois desta linha.
  // O dotenv do prisma.config.ts não sobrescreve uma var já definida, então o
  // .env local (porta 5433) não atrapalha o container de teste.
  process.env.DATABASE_URL = url;

  // Aplica as migrations (tabelas + a EXCLUDE constraint) no container.
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  return container;
}
