import { Router } from "express";
import * as waitlistController from "../controllers/waitlist.controller.js";

export const waitlistRouter = Router();

waitlistRouter.post("/", waitlistController.join); // POST   /waitlist
waitlistRouter.get("/", waitlistController.list); // GET    /waitlist?resourceId=&userId=
waitlistRouter.delete("/:id", waitlistController.leave); // DELETE /waitlist/:id
