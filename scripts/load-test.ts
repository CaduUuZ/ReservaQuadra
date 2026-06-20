// Teste de concorrência: dispara N reservas SIMULTÂNEAS para a MESMA quadra e
// o MESMO horário. Prova que a constraint do banco deixa passar exatamente 1
// e rejeita as outras com 409 — sem lock manual na aplicação.
//
//   npm run loadtest            (50 requisições, padrão)
//   npm run loadtest -- 100     (100 requisições)
//
// Pré-requisitos: servidor rodando (npm run dev) e seed aplicado (npm run seed).
import { prisma } from "../src/db/prisma.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const N = Number(process.argv[2]) || 50;

// Quadra e usuário criados pelo seed.
const RESOURCE_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

// Um horário qualquer no futuro — o mesmo pra todas as requisições.
const STARTS_AT = "2030-01-01T10:00:00Z";
const ENDS_AT = "2030-01-01T11:00:00Z";

async function postBooking() {
  const res = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resourceId: RESOURCE_ID,
      userId: USER_ID,
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
    }),
  });
  return res.status;
}

async function main() {
  // Garante o cenário limpo: nenhuma reserva pré-existente nesse horário.
  await prisma.booking.deleteMany({ where: { resourceId: RESOURCE_ID } });

  console.log(`\n🏐 Disparando ${N} reservas SIMULTÂNEAS para a mesma quadra/horário...`);
  console.log(`   ${STARTS_AT} → ${ENDS_AT} @ ${BASE_URL}\n`);

  const started = Date.now();
  // Promise.all = todas as requisições "ao mesmo tempo", sem esperar uma pela outra.
  const statuses = await Promise.all(Array.from({ length: N }, postBooking));
  const elapsed = Date.now() - started;

  // Agrupa por status HTTP.
  const counts = statuses.reduce<Record<number, number>>((acc, s) => {
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const ok = counts[201] ?? 0;
  const conflict = counts[409] ?? 0;
  const others = N - ok - conflict;

  console.log("📊 Resultado:");
  for (const [status, qtd] of Object.entries(counts).sort()) {
    const label = status === "201" ? "criada" : status === "409" ? "conflito" : "inesperado";
    console.log(`   HTTP ${status} (${label}): ${qtd}`);
  }
  console.log(`   tempo total: ${elapsed}ms\n`);

  // Veredito: o esperado é EXATAMENTE 1 sucesso e o resto conflito.
  const passou = ok === 1 && conflict === N - 1 && others === 0;
  console.log(
    passou
      ? `✅ PASSOU: 1 reserva criada, ${conflict} bloqueadas pelo banco. Zero double-booking.`
      : `❌ FALHOU: esperado 1×201 e ${N - 1}×409, veio ${ok}×201 / ${conflict}×409 / ${others} outros.`,
  );

  process.exitCode = passou ? 0 : 1;
}

main()
  .catch((e) => {
    console.error("❌ Erro no load test:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
