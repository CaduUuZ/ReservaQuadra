// Aumenta o tipo Request do Express com os dados que o authMiddleware injeta.
// Assim o TS reconhece req.userId / req.userName nos controllers.
import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userName?: string;
    }
  }
}
