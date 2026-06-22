import type { Request, Response } from "express";
import { z } from "zod";
import * as resourceService from "../services/resource.service.js";

const paramsSchema = z.object({ id: z.guid("id deve ser um UUID") });
const querySchema = z.object({ date: z.coerce.date() }); // ?date=2026-06-21

// Corpo pra criar/editar quadra (usado pela empresa dona).
const resourceBodySchema = z.object({
  name: z.string().min(2, "nome muito curto"),
  sports: z
    .array(z.enum(["FUTEBOL", "VOLEI", "TENIS", "BEACH_TENNIS", "FUTEVOLEI", "BASQUETE"]))
    .min(1, "escolha ao menos um esporte"),
  surface: z.enum(["AREIA", "SAIBRO", "SINTETICO", "CIMENTO", "GRAMA"]),
  pricePerHour: z.coerce.number().int().min(0).nullable().optional(),
});

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

// --- Gestão pela empresa dona ---

export async function listMine(req: Request, res: Response) {
  const resources = await resourceService.listResourcesByOwner(req.userId!);
  res.json(resources);
}

export async function create(req: Request, res: Response) {
  const data = resourceBodySchema.parse(req.body);
  const resource = await resourceService.createResource(req.userId!, data);
  res.status(201).json(resource);
}

export async function update(req: Request, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  const data = resourceBodySchema.parse(req.body);
  const resource = await resourceService.updateResource(id, req.userId!, data);
  res.json(resource);
}
