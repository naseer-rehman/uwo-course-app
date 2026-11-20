import express, { type Express, type Request, type Response } from 'express';
import expressSession, { type SessionData } from "express-session";
import connectPgSimple from "connect-pg-simple";
import dbPool from "./utils/database";
import cookieParser from "cookie-parser";


const pgSession = connectPgSimple(expressSession);

import loginRouter from "./routers/loginRouter";
import logoutRouter from "./routers/logoutRouter";
import authRouter from "./routers/authRouter";

const app = express();

declare module "express-session" {
  interface SessionData {
    userId?: string;
    authToken?: string;
  }
}

const ONE_DAY = 86400;
const ONE_DAY_MS = ONE_DAY * 1000;
app.use(
  expressSession({
    secret: Bun.env.COOKIE_SECRET ?? "MR_MUNAVVAR_MOTALA",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: false, // TODO: ?
      maxAge: 5 * ONE_DAY_MS,
      secure: app.get("env") === "production",
    },
    store: new pgSession({
      pool: dbPool,
      createTableIfMissing: true,
    }),
  })
);

app.use(cookieParser());

app.use("/login", loginRouter);
app.use("/logout", logoutRouter);
app.use("/auth", authRouter);


app.get('/', (req: Request, res: Response) => {
  res.status(501).send('Hello World!');
});


export default app;