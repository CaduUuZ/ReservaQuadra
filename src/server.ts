// Ponto de entrada: sobe o servidor HTTP + o Socket.IO (chat em tempo real).
import { createServer } from "node:http";
import { app } from "./app.js";
import { createSocketServer } from "./socket.js";
import { logger } from "./logger.js";

const PORT = Number(process.env.PORT) || 3000;

// Precisamos do http.Server explícito pra o Socket.IO compartilhar a mesma porta.
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`🚀 ReservaQuadra ouvindo em http://localhost:${PORT}`);
});
