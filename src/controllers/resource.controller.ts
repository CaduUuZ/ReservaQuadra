import type { Request, Response } from "express";
import { z } from "zod";
import * as resourceService from "../services/resource.service.js";

const paramsSchema = z.object({ id: z.guid("id deve ser um UUID") });
const querySchema = z.object({ date: z.coerce.date() }); // ?date=2026-06-21

export async function list(_req: Request, res: Response) {
  const resources = await resourceService.listResources();
  res.json(resources);
}

export async function availability(req: Request, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  const { date } = querySchema.parse(req.query);
  const result = await resourceService.getAvailability(id, date);
  res.json(result);
}
