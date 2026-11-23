import { expect, test } from "bun:test";
import * as bunTest from "bun:test";
import userModel from "../../src/models/users";


const dummyUwoEmail = "dummydata@uwo.ca";


test.serial("User creation, retrieval, and deletion", async () => {
  const newUser = await userModel.createNewUser(dummyUwoEmail);
  expect(newUser).not.toBeNull();
  expect(newUser?.uwoEmail).toBeString();
  expect(newUser?.uwoEmail).toBe(dummyUwoEmail);
  expect(newUser?.id).toBeString();
  expect(newUser?.id.length).toBeGreaterThan(0);
  expect(newUser?.createdAt).toBeValidDate();
  expect(newUser?.lastLoginAt).toBeValidDate();

  const user = await userModel.getUserByEmail(dummyUwoEmail);
  expect(user).not.toBeNull();
  expect(user?.uwoEmail).toBe(dummyUwoEmail);
  expect(user?.createdAt).toBeValidDate();
  expect(user?.lastLoginAt).toBeValidDate();

  const result = await userModel.deleteUserByEmail(dummyUwoEmail);
  expect(result).toBeTrue();
});
