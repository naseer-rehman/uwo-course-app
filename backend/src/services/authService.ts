import userModel, { type User } from "../models/users";


// Generates an authentication request for the specified email,
// for the connected client.
export async function startAuthFlow(email: string) {
  // TODO: Implement
  const token = Bun.randomUUIDv7();

}


export async function checkUserExists(userId: string): Promise<User | false> {
  const user = await userModel.getUserById(userId);
  return user ?? false;
}


export default {
  checkUserExists,
  startAuthFlow,
};