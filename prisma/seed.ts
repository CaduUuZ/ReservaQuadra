// Popula dados básicos pra desenvolvimento e pros testes de carga.
// Usa upsert => rodar de novo não duplica nada (idempotente).
//   npm run seed
import { prisma } from "../src/db/prisma.js";

// IDs fixos pra facilitar testes manuais e o load test.
const USER_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID_2 = "44444444-4444-4444-4444-444444444444";
const QUADRA_A = "11111111-1111-1111-1111-111111111111";
const QUADRA_B = "33333333-3333-3333-3333-333333333333";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, name: "Cadu", email: "cadu@reservaquadra.dev" },
  });

  await prisma.user.upsert({
    where: { id: USER_ID_2 },
    update: {},
    create: { id: USER_ID_2, name: "Bia", email: "bia@reservaquadra.dev" },
  });

  const resources = await Promise.all([
    prisma.resource.upsert({
      where: { id: QUADRA_A },
      update: {},
      create: { id: QUADRA_A, name: "Quadra A - Society" },
    }),
    prisma.resource.upsert({
      where: { id: QUADRA_B },
      update: {},
      create: { id: QUADRA_B, name: "Quadra B - Tênis" },
    }),
  ]);

  console.log("🌱 Seed concluído:");
  console.log(`   usuário: ${user.name} (${user.id})`);
  for (const r of resources) console.log(`   quadra:  ${r.name} (${r.id})`);
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
