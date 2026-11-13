import express, { type Request, type Response } from "express";
import loginController from "../controllers/loginController";

const router = express.Router();

// TODO: What do I do for the root route
router.get("/", async () => {});
// TODO: I might have to move this route
router.get("/status", loginController.checkLoginStatus);

export default router;
