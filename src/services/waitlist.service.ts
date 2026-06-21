// Regra de negócio da fila de espera.
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { ConflictError, NotFoundError } from "../errors.js";
import { isForeignKeyViolation } from "../pg-errors.js";

interface JoinWaitlistInput {
  resourceId: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
}

interface ListWaitlistFilters {
  resourceId?: string;
  userId?: string;
}

export async function joinWaitlist(input: JoinWaitlistInput) {
  // Evita duplicar: mesmo usuário, mesma quadra/horário, ainda aguardando.
  const existing = await prisma.waitlistEntry.findFirst({
    where: { ...input, status: "WAITING" },
  });
  if (existing) {
    throw new ConflictError("Você já está na fila para este horário");
  }

  try {
    return await prisma.waitlistEntry.create({ data: input });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Quadra ou usuário informado não existe");
    }
    throw error;
  }
}

export async function listWaitlist(filters: ListWaitlistFilters) {
  const where: Prisma.WaitlistEntryWhereInput = { status: "WAITING" };
  if (filters.resourceId) where.resourceId = filters.resourceId;
  if (filters.userId) where.userId = filters.userId;

  const entries = await prisma.waitlistEntry.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { resource: true, user: true },
  });

  // Calcula a posição na fila dentro de cada quadra+horário (1 = próximo).
  const positionBySlot = new Map<string, number>();
  return entries.map((e) => {
    const slot = `${e.resourceId}|${e.startsAt.toISOString()}|${e.endsAt.toISOString()}`;
    const position = (positionBySlot.get(slot) ?? 0) + 1;
    positionBySlot.set(slot, position);
    return { ...e, position };
  });
}

export async function leaveWaitlist(id: string) {
  try {
    // Marca como CANCELLED em vez de apagar, pra manter histórico.
    return await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError("Entrada na fila não encontrada");
    }
    throw error;
  }
}
