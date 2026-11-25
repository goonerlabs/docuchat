import type { Request, Response } from "express";
import * as userService from "../services/user.service.js";

export async function me(req: Request, res: Response) {
  // "authenticate" ran before this handler, so req.user is there.
  const user = await userService.getProfile(req.user!.id);
  res.json({ user });
}

export async function listUsers(_req: Request, res: Response) {
  const users = await userService.listUsers();
  res.json({ users });
}
