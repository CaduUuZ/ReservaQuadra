// Regra de negócio das reservas. Esta camada não conhece HTTP:
// ela fala com o banco (Prisma) e lança erros de domínio quando algo dá errado.
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { ConflictError, NotFoundError } from "../errors.js";

interface CreateBookingInput {
  resourceId: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
}

interface ListBookingFilters {
  userId?: string;
  resourceId?: string;
  date?: Date; // se vier, filtra reservas que começam naquele dia
}

// No Prisma 7 (driver adapter), erros de constraint do banco chegam como
// DriverAdapterError, com o código nativo do Postgres em error.cause.code.
// Pegar esse código é bem mais robusto que confiar no tipo do erro do Prisma.
function pgErrorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string; originalCode?: string } })?.cause;
  return cause?.code ?? cause?.originalCode;
}

// 23P01 = exclusion_violation -> nossa constraint de sobreposição de horário.
function isOverlapConflict(error: unknown): boolean {
  if (pgErrorCode(error) === "23P01") return true;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("bookings_no_overlap");
}

// 23503 (Postgres) ou P2003 (Prisma) = foreign key violation ->
// a quadra ou o usuário informado não existe.
function isForeignKeyViolation(error: unknown): boolean {
  if (pgErrorCode(error) === "23503") return true;
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
  );
}

export async function createBooking(input: CreateBookingInput) {
  try {
    // Lock consultivo (advisory) por quadra, dentro de uma transação.
    // Ele serializa as inserções concorrentes da MESMA quadra em uma fila
    // ordenada, evitando os deadlocks que a constraint de exclusão gera sob
    // alta contenção. A "perdedora" falha na hora com 23P01 (e vira 409),
    // sem esperar o deadlock_timeout. O lock é liberado ao fim da transação.
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.resourceId}))`;
      return tx.booking.create({ data: input });
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
    include: { resource: true, user: true },
  });
}

export async function deleteBooking(id: string) {
  try {
    return await prisma.booking.delete({ where: { id } });
  } catch (error) {
    // P2025 = registro não encontrado para deletar.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError("Reserva não encontrada");
    }
    throw error;
  }
}
