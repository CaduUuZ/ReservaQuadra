// Regra de negócio dos participantes de um jogo (reserva).
import { prisma } from "../db/prisma.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.js";
import { isForeignKeyViolation } from "../pg-errors.js";

interface AddParticipantInput {
  userId?: string; // participante cadastrado
  guestName?: string; // OU convidado sem conta
}

// Garante que quem mexe nos participantes é o DONO do jogo.
async function loadOwnedBooking(bookingId: string, requesterId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundError("Jogo não encontrado");
  if (booking.userId !== requesterId) {
    throw new ForbiddenError("Apenas o dono do jogo pode gerenciar os participantes");
  }
  return booking;
}

export async function addParticipant(
  bookingId: string,
  requesterId: string,
  input: AddParticipantInput,
) {
  await loadOwnedBooking(bookingId, requesterId);

  // Não deixa o mesmo usuário cadastrado entrar duas vezes no jogo.
  if (input.userId) {
    const dup = await prisma.participant.findFirst({
      where: { bookingId, userId: input.userId },
    });
    if (dup) throw new ConflictError("Esse usuário já está no jogo");
  }

  try {
    return await prisma.participant.create({
      data: { bookingId, userId: input.userId, guestName: input.guestName },
      include: { user: true },
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new NotFoundError("Usuário não encontrado");
    throw error;
  }
}

export async function removeParticipant(
  bookingId: string,
  participantId: string,
  requesterId: string,
) {
  const booking = await loadOwnedBooking(bookingId, requesterId);

  const participant = await prisma.participant.findUnique({ where: { id: participantId } });
  if (!participant || participant.bookingId !== bookingId) {
    throw new NotFoundError("Participante não encontrado");
  }
  // O dono é sempre participante e não pode se remover (cancelaria o sentido do jogo).
  if (participant.userId && participant.userId === booking.userId) {
    throw new ForbiddenError("O dono não pode ser removido do próprio jogo");
  }

  await prisma.participant.delete({ where: { id: participantId } });
}
