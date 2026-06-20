import { Router } from "express";
import * as bookingController from "../controllers/booking.controller.js";

export const bookingRouter = Router();

bookingRouter.post("/", bookingController.create); // POST   /bookings
bookingRouter.get("/", bookingController.list); // GET    /bookings?userId=&resourceId=&date=
bookingRouter.delete("/:id", bookingController.remove); // DELETE /bookings/:id
