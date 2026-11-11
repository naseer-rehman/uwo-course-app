import express, { type Express, type Request, type Response } from 'express';
import expressSession, { type SessionData } from "express-session";
import connectPgSimple from "connect-pg-simple";
import dbPool from "./utils/database";
import cookieParser from "cookie-parser";
import https from "https";
import http from "http";
import fs from "fs";
import path from "node:path";

const pgSession = connectPgSimple(expressSession);

import loginRouter from "./routers/loginRouter";

const app = express();
const httpsPort = Bun.env.SERVER_PORT ?? 3000;
const httpPort = Bun.env.HTTP_SERVER_PORT ?? 4000;

declare module "express-session" {
  interface SessionData {
    userId?: string;
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

app.get('/', (req: Request, res: Response) => {
  res.status(501).send('Hello World!');
});

// const path: fs.PathOrFileDescriptor = ;

const keyPath = Bun.env.TLS_KEY_PATH 
  ?? path.resolve(import.meta.dirname, "../certs/localhost-key.pem");
const certPath = Bun.env.TLS_CERT_PATH 
  ?? path.resolve(import.meta.dirname, "../certs/localhost.pem");

const options: https.ServerOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const httpsServer = https.createServer(options, app).listen(httpsPort);
const httpServer = http.createServer(app).listen(httpPort);

const logServerAddress = (serverName: string, address: ReturnType<(typeof httpsServer.address)>) => {
  if (address === null) return;

  if (typeof address === "string") {
    console.log(`${serverName} running on ${address}`);
  } else {
    console.log(`${serverName} running on ${address.address}:${address.port}/${address.family}`);
  }
};
logServerAddress("HTTPS server", httpsServer.address());
logServerAddress("HTTP server", httpServer.address());

process.on('SIGTERM', async () => {
  console.log("Beginning graceful server shutdown");

  httpsServer.closeAllConnections();
  httpServer.closeAllConnections();
  
  const httpsServerClosePromise = new Promise((resolve, reject) => {
    httpsServer.close(resolve);
  });
  const httpServerClosePromise = new Promise((resolve, reject) => {
    httpServer.close((error) => { 
      resolve(undefined); 
    });
  });
  await Promise.all([httpServerClosePromise, httpsServerClosePromise]);

  await dbPool.end();
});