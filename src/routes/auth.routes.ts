import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.js";

export const authRouter = Router();

authRouter.post("/register", authController.register); // POST /auth/register
authRouter.post("/login", authController.login); // POST /auth/login
authRouter.get("/me", authMiddleware, authController.me); // GET /auth/me (protegida)
