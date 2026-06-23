// Servidor Socket.IO: chat em tempo real, com uma "sala" por jogo (booking).
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken } from "./auth/jwt.js";
import { isMember, saveMessage } from "./services/chat.service.js";
import { logger } from "./logger.js";

interface SocketData {
  userId: string;
  userName: string;
}

const room = (bookingId: string) => `booking:${bookingId}`;

export function createSocketServer(httpServer: HttpServer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const io = new Server<any, any, any, SocketData>(httpServer, {
    cors: { origin: "*" }, // em prod, restringir à origem do frontend
  });

  // Autenticação no handshake: exige o mesmo JWT da API (em socket.auth.token).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Token ausente"));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.sub;
      socket.data.userName = payload.name;
      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data;

    // Entrar na sala de um jogo (só se for membro).
    socket.on("join", async (bookingId: string) => {
      if (await isMember(bookingId, userId)) socket.join(room(bookingId));
    });

    socket.on("leave", (bookingId: string) => {
      socket.leave(room(bookingId));
    });

    // Enviar mensagem: valida membro, persiste e transmite pra sala.
    socket.on(
      "message",
      async (
        payload: { bookingId: string; text: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          const text = String(payload?.text ?? "").trim().slice(0, 1000);
          if (!text) return ack?.({ ok: false, error: "Mensagem vazia" });
          const msg = await saveMessage(payload.bookingId, userId, text);
          io.to(room(payload.bookingId)).emit("message", msg);
          ack?.({ ok: true });
        } catch (e) {
          ack?.({ ok: false, error: e instanceof Error ? e.message : "Erro" });
        }
      },
    );
  });

  logger.info("💬 Socket.IO pronto (chat em tempo real)");
  return io;
}
