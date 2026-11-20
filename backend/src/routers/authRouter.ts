import { Router, type Request, type Response } from "express";
import authController from "../controllers/authController";

const router = Router();

// TODO: Implement verification to create authenticated session
router.get("/verify", async (req: Request, res: Response) => {
  res.sendStatus(501);
});

// TODO: Implement 
router.get("/status", authController.checkLoginStatus);

export default router;