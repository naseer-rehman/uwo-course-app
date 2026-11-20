import express, { type Request, type Response } from "express";
import authController from "../controllers/authController";

const router = express.Router();

// TODO: What do I do for the root route
router.get("/", async (req, res) => {
  res.send("Sup").status(501);
});

router.post("/", authController.attemptLogin);

export default router;
