import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

export const adminRoutes = Router();

// Protected, and only for the role "admin".
adminRoutes.get("/users", authenticate, authorize("admin"), userController.listUsers);
