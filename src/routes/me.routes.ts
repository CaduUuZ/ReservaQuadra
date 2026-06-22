import { Router } from "express";
import * as meController from "../controllers/me.controller.js";

export const meRouter = Router();

meRouter.get("/bookings", meController.myBookings); // GET /me/bookings
meRouter.get("/stats", meController.myStats); // GET /me/stats
