import express, { type Express, type Request, type Response } from 'express';

import loginRouter from "./routers/loginRouter";

const app: Express = express();
const port = process.env.SERVER_PORT ?? 3000;

app.use("/login", loginRouter);

app.get('/', (req: Request, res: Response) => {
  res.status(501).send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});