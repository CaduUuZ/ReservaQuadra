import type { Request, Response } from "express";
import { z } from "zod";
import * as bookingService from "../services/booking.service.js";

// --- Schemas de validação (o Zod lança ZodError -> 400 no handler central) ---

// O userId NÃO vem mais do corpo — vem do token (req.userId). Isso evita que
// alguém reserve "em nome de outro" só mandando outro id no body.
const createSchema = z
  .object({
    resourceId: z.guid("resourceId deve ser um UUID"),
    startsAt: z.coerce.date(), // aceita string ISO e converte pra Date
    endsAt: z.coerce.date(),
  })
  // Regra de negócio simples que não precisa do banco: fim depois do início.
  .refine((d) => d.endsAt > d.startsAt, {
    message: "endsAt deve ser depois de startsAt",
    path: ["endsAt"],
  });

const listSchema = z.object({
  userId: z.guid().optional(),
  resourceId: z.guid().optional(),
  date: z.coerce.date().optional(),
});

const idSchema = z.object({ id: z.guid("id deve ser um UUID") });

// --- Handlers ---

export async function create(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const booking = await bookingService.createBooking({ ...data, userId: req.userId! });
  res.status(201).json(booking);
}

export async function list(req: Request, res: Response) {
  const filters = listSchema.parse(req.query);
  const bookings = await bookingService.listBookings(filters);
  res.json(bookings);
}

export async function remove(req: Request, res: Response) {
  const { id } = idSchema.parse(req.params);
  // Passa o usuário logado pra o service barrar cancelamento de reserva alheia.
  const result = await bookingService.cancelBooking(id, req.userId!);
  // 200 (em vez de 204) porque o cancelamento pode promover alguém da fila —
  // devolvemos no corpo se uma nova reserva foi criada automaticamente.
  res.json({
    cancelled: result.cancelledId,
    promoted: result.promotedBooking,
  });
}
