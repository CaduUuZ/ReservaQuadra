// Regra de negócio das quadras, incluindo o cálculo de disponibilidade.
import { prisma } from "../db/prisma.js";
import { NotFoundError } from "../errors.js";

// Horário de funcionamento e tamanho do bloco (poderia virar config por quadra depois).
const OPENING_HOUR = 8; // 08:00
const CLOSING_HOUR = 22; // 22:00
const SLOT_MINUTES = 60;

interface Slot {
  startsAt: Date;
  endsAt: Date;
  available: boolean;
}

export async function getAvailability(resourceId: string, date: Date) {
  // 1) A quadra precisa existir.
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw new NotFoundError("Quadra não encontrada");

  // 2) Janela do dia [00:00, próximo dia 00:00), em UTC.
  // Tudo aqui é UTC pra ser consistente com o timestamptz do Postgres.
  // (Em produção, o ideal seria fixar o fuso da quadra, ex: America/Sao_Paulo,
  // com uma lib como Luxon — fica como evolução.)
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // 3) Reservas existentes da quadra que tocam esse dia.
  const bookings = await prisma.booking.findMany({
    where: {
      resourceId,
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
  });

  // 4) Gera os blocos e marca como livre/ocupado conforme sobreposição.
  const slots: Slot[] = [];
  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour += SLOT_MINUTES / 60) {
    const slotStart = new Date(dayStart);
    slotStart.setUTCHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_MINUTES);

    // Sobreposição: começa antes do bloco acabar E termina depois do bloco começar.
    const taken = bookings.some(
      (b) => b.startsAt < slotEnd && b.endsAt > slotStart,
    );

    slots.push({ startsAt: slotStart, endsAt: slotEnd, available: !taken });
  }

  return { resource, date: dayStart, slots };
}
