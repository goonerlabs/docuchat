import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";

// Layer 2: the only layer that knows HTTP.
// It reads the request, calls the service with plain data, and writes the response.
// Express 5 sends an error from an async handler to the error handler, so no try/catch here.

export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const result = await authService.login({ ...req.body, deviceInfo: req.headers["user-agent"] });
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.body.refreshToken, req.headers["user-agent"]);
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  res.json({ message: "Logged out" });
}
