// Middleware central de erros do Express.
// Toda exceção lançada nos controllers/services cai aqui e vira uma resposta HTTP
// padronizada. É o único lugar que decide status code + formato do corpo de erro.
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // O Express identifica o error handler pela assinatura de 4 args — por isso
  // "next" precisa existir mesmo sem ser usado.
  _next: NextFunction,
): void {
  // 1) Erro de validação do Zod -> 400 com a lista de problemas.
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Dados inválidos", details: err.issues });
    return;
  }

  // 2) Nossos erros de domínio já carregam o status certo.
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err instanceof ValidationError && err.details) body.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  // 3) Qualquer outra coisa é um bug inesperado -> 500 (e logamos pra investigar).
  console.error("[erro inesperado]", err);
  res.status(500).json({ error: "Erro interno do servidor" });
}
