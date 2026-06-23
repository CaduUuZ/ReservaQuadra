import type { Request, Response } from "express";
import { z } from "zod";
import * as chatService from "../services/chat.service.js";

const paramsSchema = z.object({ id: z.guid("id deve ser um UUID") });

// GET /bookings/:id/messages — histórico do chat (só membros).
export async function list(req: Request, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  const messages = await chatService.listMessages(id, req.userId!);
  res.json(messages);
}
