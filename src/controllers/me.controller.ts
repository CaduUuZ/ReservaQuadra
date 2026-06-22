import type { Request, Response } from "express";
import * as meService from "../services/me.service.js";

export async function myBookings(req: Request, res: Response) {
  const bookings = await meService.getMyBookings(req.userId!);
  res.json(bookings);
}

export async function myStats(req: Request, res: Response) {
  const stats = await meService.getMyStats(req.userId!);
  res.json(stats);
}
