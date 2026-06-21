import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";
import { bookingRouter } from "./routes/booking.routes.js";
import { resourceRouter } from "./routes/resource.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { waitlistRouter } from "./routes/waitlist.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

export const app = express();

// Libera o frontend (origem diferente: a SPA roda em outra porta) a chamar a API.
// Em produção, restringir o "origin" aos domínios confiáveis.
app.use(cors());

// Loga toda requisição HTTP (método, status, tempo) e injeta req.log
// com um id de requisição pra correlacionar logs da mesma chamada.
app.use(pinoHttp({ logger }));

// Faz o Express parsear corpo JSON e popular req.body.
app.use(express.json());

// Rotas da aplicação.
app.use("/health", healthRouter);
app.use("/resources", resourceRouter);
app.use("/bookings", bookingRouter);
app.use("/waitlist", waitlistRouter);
app.use("/users", userRouter);

// Rota não encontrada -> 404 padronizado.
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Handler de erros SEMPRE por último (Express identifica pelos 4 parâmetros).
app.use(errorHandler);
