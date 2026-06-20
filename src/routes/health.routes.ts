import { Router } from "express";
import { prisma } from "../db/prisma.js";

export const healthRouter = Router();

// GET /health -> confirma que a app está de pé E que o banco responde.
healthRouter.get("/", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", db: "up" });
});
