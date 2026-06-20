import express from "express";
import { bookingRouter } from "./routes/booking.routes.js";
import { resourceRouter } from "./routes/resource.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

export const app = express();

// Faz o Express parsear corpo JSON e popular req.body.
app.use(express.json());

// Rotas da aplicação.
app.use("/health", healthRouter);
app.use("/resources", resourceRouter);
app.use("/bookings", bookingRouter);

// Rota não encontrada -> 404 padronizado.
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Handler de erros SEMPRE por último (Express identifica pelos 4 parâmetros).
app.use(errorHandler);
