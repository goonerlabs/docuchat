import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, refreshTokenSchema, registerSchema } from "../schemas/auth.schema.js";

// Layer 1: a route connects a URL and a method to a controller function. No logic here.
export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), authController.register);
authRoutes.post("/login", validate(loginSchema), authController.login);
authRoutes.post("/refresh", validate(refreshTokenSchema), authController.refresh);
authRoutes.post("/logout", validate(refreshTokenSchema), authController.logout);
