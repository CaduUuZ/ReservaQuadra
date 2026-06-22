// Regra de negócio dos participantes de um jogo (reserva).
import { prisma } from "../db/prisma.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors.js";
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

// Sorteia os participantes em N times de forma equilibrada.
// Embaralha (Fisher-Yates) e distribui em rodízio: times ficam com tamanhos
// que diferem no máximo em 1. Persiste o campo "team" de cada participante.
export async function randomizeTeams(
  bookingId: string,
  requesterId: string,
  teamsCount = 2,
) {
  await loadOwnedBooking(bookingId, requesterId);

  const participants = await prisma.participant.findMany({ where: { bookingId } });
  if (participants.length < teamsCount) {
    throw new ValidationError(
      `Participantes insuficientes: ${participants.length} para ${teamsCount} times`,
    );
  }

  // Fisher-Yates: embaralho imparcial in-place.
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Distribuição em rodízio (índice % N) => times equilibrados. Tudo numa
  // transação: ou todos recebem time, ou nenhum (sem escalação pela metade).
  await prisma.$transaction(
    shuffled.map((p, idx) =>
      prisma.participant.update({
        where: { id: p.id },
        data: { team: (idx % teamsCount) + 1 },
      }),
    ),
  );

  return prisma.participant.findMany({
    where: { bookingId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

// Desfaz a escalação: volta todo mundo pra "sem time".
export async function clearTeams(bookingId: string, requesterId: string) {
  await loadOwnedBooking(bookingId, requesterId);
  await prisma.participant.updateMany({ where: { bookingId }, data: { team: null } });
}
