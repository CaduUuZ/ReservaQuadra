// Dados do usuário logado: seus jogos (como dono ou participante) e estatísticas.
import { prisma } from "../db/prisma.js";

// Jogos em que o usuário é DONO ou está na lista de participantes.
const involvedIn = (userId: string) => ({
  OR: [{ userId }, { participants: { some: { userId } } }],
});

export async function getMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: involvedIn(userId),
    include: {
      resource: true,
      user: true,
      participants: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { startsAt: "asc" },
  });
}

// Número do dia (UTC) — pra contar dias distintos jogados.
const dayNumber = (d: Date) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000);

// Número da SEGUNDA-feira da semana de uma data (em dias) — pra agrupar por semana.
function weekMonday(d: Date): number {
  const dow = (d.getUTCDay() + 6) % 7; // Seg=0 ... Dom=6
  return dayNumber(d) - dow;
}

export async function getMyStats(userId: string) {
  const now = new Date();
  // Só jogos passados contam como "jogou".
  const past = await prisma.booking.findMany({
    where: { AND: [{ startsAt: { lt: now } }, involvedIn(userId)] },
    select: { startsAt: true },
  });

  const totalGames = past.length;
  const daysPlayed = new Set(past.map((b) => dayNumber(b.startsAt))).size;

  // Streak de semanas seguidas: semanas (segundas) distintas, em ordem decrescente;
  // conta o quanto elas se encadeiam (cada uma 7 dias antes da anterior).
  const weeks = [...new Set(past.map((b) => weekMonday(b.startsAt)))].sort((a, b) => b - a);
  let weekStreak = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (i === 0 || weeks[i] === weeks[i - 1] - 7) weekStreak++;
    else break;
  }

  return { totalGames, daysPlayed, weekStreak };
}
