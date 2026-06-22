import { Router } from "express";
import * as resourceController from "../controllers/resource.controller.js";
import { requireRole } from "../middlewares/auth.js";

export const resourceRouter = Router();

resourceRouter.get("/", resourceController.list); // GET /resources (todas)

// Gestão pela empresa dona (exige conta EMPRESA).
resourceRouter.get("/mine", requireRole("EMPRESA"), resourceController.listMine);
resourceRouter.post("/", requireRole("EMPRESA"), resourceController.create);
resourceRouter.patch("/:id", requireRole("EMPRESA"), resourceController.update);

// GET /resources/:id/availability?date=2026-06-21
resourceRouter.get("/:id/availability", resourceController.availability);
