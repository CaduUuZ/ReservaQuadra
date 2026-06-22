import { Router } from "express";
import * as bookingController from "../controllers/booking.controller.js";
import * as participantController from "../controllers/participant.controller.js";

export const bookingRouter = Router();

bookingRouter.post("/", bookingController.create); // POST   /bookings
bookingRouter.get("/", bookingController.list); // GET    /bookings?userId=&resourceId=&date=
bookingRouter.delete("/:id", bookingController.remove); // DELETE /bookings/:id

// Participantes de um jogo (só o dono gerencia).
bookingRouter.post("/:id/participants", participantController.add);
bookingRouter.delete("/:id/participants/:participantId", participantController.remove);

// Times (sortear / limpar) — só o dono.
bookingRouter.post("/:id/teams/randomize", participantController.randomizeTeams);
bookingRouter.delete("/:id/teams", participantController.clearTeams);
