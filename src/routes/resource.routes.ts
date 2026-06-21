import { Router } from "express";
import * as resourceController from "../controllers/resource.controller.js";

export const resourceRouter = Router();

resourceRouter.get("/", resourceController.list); // GET /resources
// GET /resources/:id/availability?date=2026-06-21
resourceRouter.get("/:id/availability", resourceController.availability);
