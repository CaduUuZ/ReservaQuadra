import { Router } from "express";
import * as userController from "../controllers/user.controller.js";

export const userRouter = Router();

userRouter.get("/", userController.list); // GET /users
