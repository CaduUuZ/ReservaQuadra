// Ponto de entrada: sobe o servidor HTTP.
import { app } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`🚀 ReservaQuadra ouvindo em http://localhost:${PORT}`);
});
