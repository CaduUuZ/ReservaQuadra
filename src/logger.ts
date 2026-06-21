// Logger único da aplicação (pino).
// - Produção: emite JSON estruturado (fácil de indexar em Datadog/Loki/etc).
// - Dev: usa pino-pretty pra ficar colorido e legível no terminal.
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
});
