import type { Request, Response } from "express";
import * as userService from "../services/user.service.js";

export async function list(_req: Request, res: Response) {
  const users = await userService.listUsers();
  res.json(users);
}
