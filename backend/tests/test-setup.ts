import test, { beforeAll, afterAll } from "bun:test";
import dbPool, { testConnection } from "../src/utils/database";
import { setTimeout as sleep } from "node:timers/promises";

beforeAll(async () => {
  let retries = 5;
  while (retries > 0) {
    if (await testConnection(dbPool)) {
      break;
    }
    await sleep(1000);
    retries--;
  }
  if (retries == 0) {
    throw new Error(`Failed to connect to database after ${retries} retries.`);
  }
});

afterAll(async () => {
  await dbPool.end();
});