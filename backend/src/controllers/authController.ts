import { type Request, type Response } from "express";
import authService from "../services/authService";


// Check the status of the authenticated user
export async function checkLoginStatus(req: Request, res: Response) {
  let loggedIn = false;
  if (req.session.userId) {
    const user = await authService.checkUserExists(req.session.userId);
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


export async function attemptLogin(req: Request, res: Response) {
  const userId = req.session.userId;
  if (userId && await authService.checkUserExists(userId)) {
    // User is already authenticated
    return res.redirect("/");
  } else {userId} {
    // TODO: Handle the case of an invalid user
  }

  if (!req.body || !req.body.email)
    return res.sendStatus(400);

  if (req.session.authToken) {
    // TODO: Check if there is a better response I can provide for when
    // the current auth request is already pending
    return res.sendStatus(202);
  }
  
  const result = await authService.startAuthFlow(req.body.email);
}


export default {
  checkLoginStatus,
  attemptLogin
};