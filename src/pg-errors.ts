// Helpers para identificar erros vindos do Postgres.
// No Prisma 7 (driver adapter), erros de constraint chegam como DriverAdapterError,
// com o código nativo do Postgres em error.cause.code. Confiar nesse código é mais
// robusto do que depender do tipo do erro do Prisma.
import { Prisma } from "./generated/prisma/client.js";

export function pgErrorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string; originalCode?: string } })?.cause;
  return cause?.code ?? cause?.originalCode;
}

// 23P01 = exclusion_violation -> nossa constraint de sobreposição de horário.
export function isOverlapConflict(error: unknown): boolean {
  if (pgErrorCode(error) === "23P01") return true;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("bookings_no_overlap");
}

// 23503 (Postgres) ou P2003 (Prisma) = foreign key violation ->
// a quadra ou o usuário informado não existe.
export function isForeignKeyViolation(error: unknown): boolean {
  if (pgErrorCode(error) === "23503") return true;
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
  );
}
