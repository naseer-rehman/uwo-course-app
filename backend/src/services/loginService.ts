import userModel, { type User } from "../models/users";

export async function startAuthFlow(uwoEmail: string) {
  // TODO: Implement
  return null;
}

export async function checkUserExists(userId: string): Promise<User | false> {
  const user = await userModel.getUserById(userId);
  if (!user) {
    return false;
  }
  return user;
}

export default {
  checkUserExists,
};