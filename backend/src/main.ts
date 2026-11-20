import https from "https";
import http from "http";
import fs from "fs";
import path from "node:path";
import dbPool from "./utils/database";
import app from "./app";


const httpsPort = Bun.env.SERVER_PORT ?? 3000;
const httpPort = Bun.env.HTTP_SERVER_PORT ?? 4000;

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