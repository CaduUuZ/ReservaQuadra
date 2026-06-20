// Erros de domínio. Cada um carrega o status HTTP que o handler central vai usar.
// Vantagem: o service lança um erro com SIGNIFICADO (ex: "conflito"), sem saber de HTTP.

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

// 404 — recurso não encontrado (ex: reservar uma quadra que não existe).
export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super(404, message);
  }
}

// 409 — conflito. É o que devolvemos quando a constraint de exclusão (23P01)
// rejeita uma reserva por sobreposição de horário.
export class ConflictError extends AppError {
  constructor(message = "Conflito de reserva: horário já ocupado") {
    super(409, message);
  }
}

// 400 — requisição malformada (validação do Zod falhou).
export class ValidationError extends AppError {
  constructor(
    message = "Dados inválidos",
    public readonly details?: unknown,
  ) {
    super(400, message);
  }
}
