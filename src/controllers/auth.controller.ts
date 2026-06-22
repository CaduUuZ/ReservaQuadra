import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";

const registerSchema = z.object({
  name: z.string().min(2, "nome muito curto"),
  email: z.email("e-mail inválido"),
  password: z.string().min(6, "a senha precisa de pelo menos 6 caracteres"),
  role: z.enum(["JOGADOR", "EMPRESA"]).optional(), // padrão JOGADOR no service
});

const loginSchema = z.object({
  email: z.email("e-mail inválido"),
  password: z.string().min(1, "senha obrigatória"),
});

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);
  const result = await authService.register(data);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);
  const result = await authService.login(data);
  res.json(result);
}

// Rota protegida: devolve o perfil do usuário logado (a partir do token).
export async function me(req: Request, res: Response) {
  const profile = await authService.getProfile(req.userId!);
  res.json(profile);
}
