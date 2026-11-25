import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticate } from "../middleware/authenticate.js";

export const userRoutes = Router();

// Protected: a valid access token is necessary.
userRoutes.get("/me", authenticate, userController.me);
