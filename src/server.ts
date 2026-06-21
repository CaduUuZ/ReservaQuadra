// Ponto de entrada: sobe o servidor HTTP.
import { app } from "./app.js";
import { logger } from "./logger.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 ReservaQuadra ouvindo em http://localhost:${PORT}`);
});
