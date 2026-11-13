import { type Request, type Response } from "express";
import loginService from "../services/loginService";

// Check the status of the authenticated user
export async function checkLoginStatus(req: Request, res: Response) {
  let loggedIn = false;
  if (req.session.userId) {
    const user = await loginService.checkUserExists(req.session.userId);
    if (user) {
      loggedIn = true;
    }
  }
  if (loggedIn) {
    res.status(200);
  } else {
    res.status(401);
  }
}

export default {
  checkLoginStatus,
};