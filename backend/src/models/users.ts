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
  const result = await dbPool.query<UserRow>(`SELECT * FROM users AS u WHERE u.id == $1`, [id]);

  if (!result.rowCount || result.rowCount < 1) {
    return null;
  }
  if (result.rowCount > 1) {
    // TODO: Named error
    throw new Error("More than 1 user for the same ID????");
  }

  let user = null;
  for (let row of result.rows) {
    user = mapUserRowToUser(row);
  }
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await dbPool.query<UserRow>(`SELECT * FROM users AS u WHERE u.uwo_email == $1`, [email]);
  return null;
}


export async function createNewUser(uwoEmail: string) {
  const queryString = 
    `INSERT INTO users(uwo_email, created_at, last_login_at) \
    VALUES ($1, $2, $3)`;
  const dateNow = Date.now();
  const result = await dbPool.query<UserRow>(queryString, [
    uwoEmail,
    dateNow,
    dateNow,
  ]);
  if (!result.rowCount || result.rowCount !== 1) {
    // TODO: Named error
    throw new Error("Could not create new user");
  }
  return result.rows[0]
    ? mapUserRowToUser(result.rows[0])
    : null;
}


export default {
  getAllUsers,
  getUserById,
  createNewUser,
};
