// Regra de negócio do chat de um jogo. Só quem participa do jogo (dono ou
// participante cadastrado) pode ler e enviar mensagens.
import { prisma } from "../db/prisma.js";
import { ForbiddenError } from "../errors.js";

export async function isMember(bookingId: string, userId: string): Promise<boolean> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, OR: [{ userId }, { participants: { some: { userId } } }] },
    select: { id: true },
  });
  return Boolean(booking);
}

export async function listMessages(bookingId: string, userId: string) {
  if (!(await isMember(bookingId, userId))) {
    throw new ForbiddenError("Você não participa deste jogo");
  }
  return prisma.message.findMany({
    where: { bookingId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function saveMessage(bookingId: string, userId: string, text: string) {
  if (!(await isMember(bookingId, userId))) {
    throw new ForbiddenError("Você não participa deste jogo");
  }
  return prisma.message.create({
    data: { bookingId, userId, text },
    include: { user: { select: { id: true, name: true } } },
  });
}
