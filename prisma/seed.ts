// Popula dados básicos pra desenvolvimento e pros testes de carga.
// Usa upsert => rodar de novo não duplica nada (idempotente).
//   npm run seed
import bcrypt from "bcryptjs";
import { prisma } from "../src/db/prisma.js";

// IDs fixos pra facilitar testes manuais e o load test.
const USER_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID_2 = "44444444-4444-4444-4444-444444444444";
const EMPRESA_ID = "55555555-5555-5555-5555-555555555555";
const QUADRA_A = "11111111-1111-1111-1111-111111111111";
const QUADRA_B = "33333333-3333-3333-3333-333333333333";

async function main() {
  // Senha padrão dos usuários de exemplo (hasheada). Login: e-mail + "senha123".
  const senhaHash = await bcrypt.hash("senha123", 10);

  const user = await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, name: "Cadu", email: "cadu@reservaquadra.dev", password: senhaHash },
  });

  await prisma.user.upsert({
    where: { id: USER_ID_2 },
    update: {},
    create: { id: USER_ID_2, name: "Bia", email: "bia@reservaquadra.dev", password: senhaHash },
  });

  // Conta de EMPRESA dona das quadras (login: arena@reservaquadra.dev / senha123).
  await prisma.user.upsert({
    where: { id: EMPRESA_ID },
    update: { role: "EMPRESA" },
    create: { id: EMPRESA_ID, name: "Arena Sports", email: "arena@reservaquadra.dev", password: senhaHash, role: "EMPRESA" },
  });

  const resources = await Promise.all([
    prisma.resource.upsert({
      where: { id: QUADRA_A },
      // Atributos também no update pra aplicar nas quadras já existentes.
      update: { name: "Quadra A - Society", sports: ["FUTEBOL", "FUTEVOLEI"], surface: "SINTETICO", pricePerHour: 12000, ownerId: EMPRESA_ID },
      create: { id: QUADRA_A, name: "Quadra A - Society", sports: ["FUTEBOL", "FUTEVOLEI"], surface: "SINTETICO", pricePerHour: 12000, ownerId: EMPRESA_ID },
    }),
    prisma.resource.upsert({
      where: { id: QUADRA_B },
      update: { name: "Quadra B - Areia", sports: ["BEACH_TENNIS", "VOLEI", "FUTEVOLEI"], surface: "AREIA", pricePerHour: 9000, ownerId: EMPRESA_ID },
      create: { id: QUADRA_B, name: "Quadra B - Areia", sports: ["BEACH_TENNIS", "VOLEI", "FUTEVOLEI"], surface: "AREIA", pricePerHour: 9000, ownerId: EMPRESA_ID },
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
