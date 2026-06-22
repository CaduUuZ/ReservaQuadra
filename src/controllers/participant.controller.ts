import type { Request, Response } from "express";
import { z } from "zod";
import * as participantService from "../services/participant.service.js";

// Exatamente um: userId (cadastrado) OU guestName (convidado).
const addSchema = z
  .object({
    userId: z.guid().optional(),
    guestName: z.string().min(1).max(60).optional(),
  })
  .refine((d) => Boolean(d.userId) !== Boolean(d.guestName), {
    message: "Informe userId (cadastrado) OU guestName (convidado), não ambos",
  });

const bookingIdSchema = z.object({ id: z.guid("id deve ser um UUID") });
const removeParamsSchema = z.object({
  id: z.guid(),
  participantId: z.guid(),
});

export async function add(req: Request, res: Response) {
  const { id } = bookingIdSchema.parse(req.params);
  const data = addSchema.parse(req.body);
  const participant = await participantService.addParticipant(id, req.userId!, data);
  res.status(201).json(participant);
}

export async function remove(req: Request, res: Response) {
  const { id, participantId } = removeParamsSchema.parse(req.params);
  await participantService.removeParticipant(id, participantId, req.userId!);
  res.status(204).send();
}

const randomizeSchema = z.object({
  teams: z.coerce.number().int().min(2).max(4).default(2),
});

export async function randomizeTeams(req: Request, res: Response) {
  const { id } = bookingIdSchema.parse(req.params);
  const { teams } = randomizeSchema.parse(req.body ?? {});
  const participants = await participantService.randomizeTeams(id, req.userId!, teams);
  res.json(participants);
}

export async function clearTeams(req: Request, res: Response) {
  const { id } = bookingIdSchema.parse(req.params);
  await participantService.clearTeams(id, req.userId!);
  res.status(204).send();
}
