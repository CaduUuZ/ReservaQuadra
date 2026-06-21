import type { Request, Response } from "express";
import { z } from "zod";
import * as waitlistService from "../services/waitlist.service.js";

// userId vem do token (req.userId), não do corpo.
const joinSchema = z
  .object({
    resourceId: z.guid("resourceId deve ser um UUID"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: "endsAt deve ser depois de startsAt",
    path: ["endsAt"],
  });

const listSchema = z.object({
  resourceId: z.guid().optional(),
  userId: z.guid().optional(),
});

const idSchema = z.object({ id: z.guid("id deve ser um UUID") });

export async function join(req: Request, res: Response) {
  const data = joinSchema.parse(req.body);
  const entry = await waitlistService.joinWaitlist({ ...data, userId: req.userId! });
  res.status(201).json(entry);
}

export async function list(req: Request, res: Response) {
  const filters = listSchema.parse(req.query);
  const entries = await waitlistService.listWaitlist(filters);
  res.json(entries);
}

export async function leave(req: Request, res: Response) {
  const { id } = idSchema.parse(req.params);
  await waitlistService.leaveWaitlist(id);
  res.status(204).send();
}
