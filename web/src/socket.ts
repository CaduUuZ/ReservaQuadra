// Conexão Socket.IO única (singleton) autenticada com o JWT.
import { io, type Socket } from "socket.io-client";
import { tokenStore } from "./api";

const URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(URL, {
      auth: { token: tokenStore.get() }, // o servidor valida no handshake
      transports: ["websocket"],
    });
  }
  return socket;
}

// Ao trocar de usuário (login/logout), derruba o socket pra reconectar com o token certo.
export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
