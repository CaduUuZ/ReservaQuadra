// Regra de negócio das reservas. Esta camada não conhece HTTP:
// ela fala com o banco (Prisma) e lança erros de domínio quando algo dá errado.
import { Prisma } from "../generated/prisma/client.js";
import type { Sport } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors.js";
import { isForeignKeyViolation, isOverlapConflict } from "../pg-errors.js";

interface CreateBookingInput {
  resourceId: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
  sport?: Sport; // esporte escolhido (precisa ser aceito pela quadra)
}

interface ListBookingFilters {
  userId?: string;
  resourceId?: string;
  date?: Date; // se vier, filtra reservas que começam naquele dia
}

export async function createBooking(input: CreateBookingInput) {
  // Se um esporte foi escolhido, ele precisa estar entre os que a quadra aceita.
  if (input.sport) {
    const resource = await prisma.resource.findUnique({ where: { id: input.resourceId } });
    if (!resource) throw new NotFoundError("Quadra não encontrada");
    if (!resource.sports.includes(input.sport)) {
      throw new ValidationError("Esta quadra não aceita o esporte selecionado");
    }
  }

  try {
    // Lock consultivo (advisory) por quadra, dentro de uma transação.
    // Ele serializa as inserções concorrentes da MESMA quadra em uma fila
    // ordenada, evitando os deadlocks que a constraint de exclusão gera sob
    // alta contenção. A "perdedora" falha na hora com 23P01 (e vira 409),
    // sem esperar o deadlock_timeout. O lock é liberado ao fim da transação.
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.resourceId}))`;
      // O dono já entra como o 1º participante do jogo (player 1).
      return tx.booking.create({
        data: { ...input, participants: { create: { userId: input.userId } } },
      });
    });
  } catch (error) {
    // O banco rejeitou por sobreposição de horário -> 409.
    if (isOverlapConflict(error)) {
      throw new ConflictError(
        "Já existe uma reserva para esta quadra no horário solicitado",
      );
    }
    // Quadra ou usuário inexistente -> 404.
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Quadra ou usuário informado não existe");
    }
    throw error; // qualquer outra coisa sobe pro handler central (500).
  }
}

export async function listBookings(filters: ListBookingFilters) {
  const where: Prisma.BookingWhereInput = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.resourceId) where.resourceId = filters.resourceId;
  if (filters.date) {
    // Reservas que COMEÇAM no dia informado. Usamos UTC pra bater com o
    // timestamptz do Postgres e evitar o "escorrega de um dia" por fuso.
    const start = new Date(filters.date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    where.startsAt = { gte: start, lt: end };
  }

  return prisma.booking.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: {
      resource: true,
      user: true,
      participants: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// Cancela uma reserva e, se houver fila para AQUELE mesmo horário, promove
// automaticamente o primeiro da fila (FIFO) a uma nova reserva.
// Tudo numa única transação + advisory lock por quadra: ou cancela-e-promove
// junto, ou nada acontece (atômico), e sem corrida com outros createBooking.
// requesterId (opcional): se informado, só o DONO da reserva pode cancelar.
// Fica opcional pra os testes/scripts internos poderem cancelar sem um "dono".
export async function cancelBooking(id: string, requesterId?: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundError("Reserva não encontrada");

    if (requesterId && booking.userId !== requesterId) {
      throw new ForbiddenError("Você só pode cancelar suas próprias reservas");
    }

    // Serializa por quadra (mesma estratégia do createBooking).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.resourceId}))`;

    await tx.booking.delete({ where: { id } });

    // Procura o próximo da fila para o MESMO horário exato.
    const next = await tx.waitlistEntry.findFirst({
      where: {
        resourceId: booking.resourceId,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: "WAITING",
      },
      orderBy: { createdAt: "asc" }, // mais antigo primeiro = FIFO
    });

    if (!next) {
      return { cancelledId: id, promotedBooking: null };
    }

    // Promove: cria a reserva para o usuário da fila (o horário acabou de vagar,
    // então não há conflito) e marca a entrada como PROMOTED.
    const promotedBooking = await tx.booking.create({
      data: {
        resourceId: next.resourceId,
        userId: next.userId,
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        participants: { create: { userId: next.userId } }, // dono promovido vira participante
      },
    });
    await tx.waitlistEntry.update({
      where: { id: next.id },
      data: { status: "PROMOTED" },
    });

    return { cancelledId: id, promotedBooking };
  });
}
