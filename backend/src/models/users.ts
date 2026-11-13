import dbPool from "../utils/database";

export interface User {
  id: string;
  uwoEmail: string;
  createdAt: Date;
  lastLoginAt: Date;
};

// TODO: Check if this is even the correct interface structure
interface UserRow {
  id: string;
  uwo_email: string;
  created_at: Date;
  last_login_at: Date;
}

function mapUserRowToUser(userRow: UserRow): User {
  return {
    id: userRow.id,
    uwoEmail: userRow.uwo_email,
    createdAt: userRow.created_at,
    lastLoginAt: userRow.last_login_at,
  };
}

export async function getAllUsers(maxEntries = 100): Promise<User[]> {
  if (maxEntries < 1) throw new Error("Max Entries must be >= 1");
  // TODO: Add in proper error handling
  const result = await dbPool.query<UserRow>("SELECT * FROM users LIMIT $1", [maxEntries]);
  const users = [];
  const rowCount = result.rowCount ?? 0;
  for (let i = 0; i < maxEntries && i < rowCount; ++i) {
    let userRow = result.rows[i];
    if (userRow)
      users.push(mapUserRowToUser(userRow));
  }
  return users;
}

export async function getUserById(id: string): Promise<User | null> {
  // TODO: Implement
  return null;
}

export async function createNewUser(uwoEmail: string) {
  // TODO: Implement
  return null;
}

export default {
  getAllUsers,
  getUserById,
  createNewUser,
};
