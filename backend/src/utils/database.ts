import pg, { type Pool } from "pg";

const pool = new pg.Pool({
  user: Bun.env.POSTGRES_USER ?? 'dbuser',
  password: Bun.env.POSTGRES_PASSWORD ?? 'secretpassword',
  host: Bun.env.POSTGRES_HOST ?? 'database.server.com',
  port: Bun.env.POSTGRES_PORT 
    ? parseInt(Bun.env.POSTGRES_PORT)
    : 5432,
  database: Bun.env.POSTGRES_DB ?? 'mydb',
});

console.log(`Created pg pool connection with user ${Bun.env.POSTGRES_USER}`);

const response = await pool.query("SELECT NOW()");
console.log(response.rows[0]);

export async function testConnection(pool: Pool, log = true) {
  try {
    const response = await pool.query("SELECT NOW()");
    if (log)
      console.log(response.rows[0]);
    return true;
  } catch (error) {
    if (log)
      console.error(error);
    return false;
  }
}


export default pool;