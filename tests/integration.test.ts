import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { startTestDatabase } from "./helpers/testDb.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../src/errors.js";

// Tipos só pra IDE; os módulos reais são importados dinamicamente no before().
let container: StartedPostgreSqlContainer;
let prisma: (typeof import("../src/db/prisma.js"))["prisma"];
let bookingService: typeof import("../src/services/booking.service.js");
let waitlistService: typeof import("../src/services/waitlist.service.js");
let resourceService: typeof import("../src/services/resource.service.js");
let authService: typeof import("../src/services/auth.service.js");

const RESOURCE = "11111111-1111-1111-1111-111111111111";
const ALICE = "22222222-2222-2222-2222-222222222222";
const BOB = "44444444-4444-4444-4444-444444444444";
const S = new Date("2026-07-01T10:00:00Z");
const E = new Date("2026-07-01T11:00:00Z");

describe("ReservaQuadra — integração (Postgres real via Testcontainers)", () => {
  before(async () => {
    container = await startTestDatabase();
    // Importes dinâmicos: só agora a DATABASE_URL aponta pro container.
    prisma = (await import("../src/db/prisma.js")).prisma;
    bookingService = await import("../src/services/booking.service.js");
    waitlistService = await import("../src/services/waitlist.service.js");
    resourceService = await import("../src/services/resource.service.js");
    authService = await import("../src/services/auth.service.js");

    // Dados base que persistem por toda a suíte. (password é coluna obrigatória;
    // aqui um valor qualquer basta, pois estes testes não exercitam login.)
    await prisma.resource.create({ data: { id: RESOURCE, name: "Quadra A" } });
    await prisma.user.create({ data: { id: ALICE, name: "Alice", email: "alice@test.dev", password: "x" } });
    await prisma.user.create({ data: { id: BOB, name: "Bob", email: "bob@test.dev", password: "x" } });
  }, { timeout: 180_000 }); // subir o container pode demorar na 1ª vez

  after(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    // Cada teste começa sem reservas/fila.
    await prisma.waitlistEntry.deleteMany();
    await prisma.booking.deleteMany();
  });

  it("cria uma reserva em horário livre", async () => {
    const booking = await bookingService.createBooking({
      resourceId: RESOURCE,
      userId: ALICE,
      startsAt: S,
      endsAt: E,
    });
    assert.ok(booking.id);
  });

  it("rejeita reserva sobreposta com ConflictError (409)", async () => {
    await bookingService.createBooking({ resourceId: RESOURCE, userId: ALICE, startsAt: S, endsAt: E });
    await assert.rejects(
      bookingService.createBooking({
        resourceId: RESOURCE,
        userId: BOB,
        startsAt: new Date("2026-07-01T10:30:00Z"),
        endsAt: new Date("2026-07-01T11:30:00Z"),
      }),
      (err) => err instanceof ConflictError && err.statusCode === 409,
    );
  });

  it("permite horários encostados (10–11 e 11–12)", async () => {
    await bookingService.createBooking({ resourceId: RESOURCE, userId: ALICE, startsAt: S, endsAt: E });
    const second = await bookingService.createBooking({
      resourceId: RESOURCE,
      userId: ALICE,
      startsAt: E, // começa exatamente quando a anterior termina
      endsAt: new Date("2026-07-01T12:00:00Z"),
    });
    assert.ok(second.id);
  });

  it("rejeita quadra inexistente com NotFoundError (404)", async () => {
    await assert.rejects(
      bookingService.createBooking({
        resourceId: "99999999-9999-4999-8999-999999999999",
        userId: ALICE,
        startsAt: S,
        endsAt: E,
      }),
      (err) => err instanceof NotFoundError && err.statusCode === 404,
    );
  });

  it("concorrência: 30 reservas simultâneas → exatamente 1 sucesso", async () => {
    const tasks = Array.from({ length: 30 }, () =>
      bookingService.createBooking({ resourceId: RESOURCE, userId: ALICE, startsAt: S, endsAt: E }),
    );
    const settled = await Promise.allSettled(tasks);
    const ok = settled.filter((s) => s.status === "fulfilled").length;
    const conflicts = settled.filter(
      (s) => s.status === "rejected" && s.reason instanceof ConflictError,
    ).length;

    assert.equal(ok, 1, "deve haver exatamente 1 reserva criada");
    assert.equal(conflicts, 29, "as outras 29 devem ser conflito (409)");
  });

  it("waitlist: cancelar uma reserva promove o próximo da fila", async () => {
    const booking = await bookingService.createBooking({
      resourceId: RESOURCE,
      userId: ALICE,
      startsAt: S,
      endsAt: E,
    });
    await waitlistService.joinWaitlist({ resourceId: RESOURCE, userId: BOB, startsAt: S, endsAt: E });

    const result = await bookingService.cancelBooking(booking.id);

    assert.ok(result.promotedBooking, "alguém deve ter sido promovido");
    assert.equal(result.promotedBooking.userId, BOB, "o promovido deve ser o Bob (1º da fila)");

    const entry = (await prisma.waitlistEntry.findMany())[0];
    assert.equal(entry.status, "PROMOTED");
  });

  it("disponibilidade marca o horário reservado como ocupado", async () => {
    await bookingService.createBooking({ resourceId: RESOURCE, userId: ALICE, startsAt: S, endsAt: E });
    const availability = await resourceService.getAvailability(RESOURCE, new Date("2026-07-01"));
    const slot10 = availability.slots.find((s) => s.startsAt.toISOString().startsWith("2026-07-01T10:00"));
    assert.equal(slot10?.available, false);
  });

  it("registro cria usuário com senha hasheada e devolve token", async () => {
    const res = await authService.register({
      name: "Nova",
      email: "nova@test.dev",
      password: "senha123",
    });
    assert.ok(res.token, "deve retornar um token");
    assert.equal(res.user.email, "nova@test.dev");
    // A senha foi hasheada (não ficou em texto puro no banco).
    const stored = await prisma.user.findUnique({ where: { id: res.user.id } });
    assert.notEqual(stored?.password, "senha123");
  });

  it("login com senha errada lança UnauthorizedError (401)", async () => {
    await authService.register({ name: "Sec", email: "sec@test.dev", password: "certa123" });
    await assert.rejects(
      authService.login({ email: "sec@test.dev", password: "errada" }),
      (err) => err instanceof UnauthorizedError && err.statusCode === 401,
    );
  });
});
