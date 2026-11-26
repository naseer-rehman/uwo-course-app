import dbPool from "../utils/database";
import { isUwoEmail } from "../utils/uwoEmail";

export enum AuthRequestStatus {
  pending = "pending",
  verified = "verified",
  complete = "complete"
};
interface AuthRequestRow {
  id: string,
  uwo_email: string,
  created_at: Date,
  expiry_at: Date,
  status: string,
};

export interface AuthRequest {
  id: string,
  uwoEmail: string,
  createdAt: Date,
  expiryAt: Date,
  status: AuthRequestStatus,
};


const isAuthRequestStatus = (value: unknown): value is AuthRequestStatus => {
  return typeof value === "string" && Object.values(AuthRequestStatus).includes(value as AuthRequestStatus);
}


function mapAuthRequestRow(row: AuthRequestRow): AuthRequest {
  const status = isAuthRequestStatus(row.status) ? row.status : null;
  // TODO: Make this a named error
  if (!status) throw new Error("Auth Request Row has an invalid status");
  return {
    ...row,
    uwoEmail: row.uwo_email,
    createdAt: row.created_at,
    expiryAt: row.expiry_at,
    status: status,
  };
}


export async function getAuthRequestById(id: string) {
  const queryString =
    `SELECT * FROM auth_requests WHERE id = $1 LIMIT 1`;
  const result = await dbPool.query<AuthRequestRow>(
    queryString, 
    [id]
  );
  if (!result.rowCount || result.rowCount === 0) {
    return null;
  }
  if (!result.rows[0]) {
    throw new Error("No Auth Request returned");
  }
  return mapAuthRequestRow(result.rows[0]);
}


const AUTH_REQUEST_TTL = 5 * 60 * 1000;

export async function createAuthRequest(email: string, id: string | null = null) {
  if (!isUwoEmail(email)) {
    throw new Error("Email supplied is not a uwo email.");
  }

  const dateNow = new Date();
  const expiryDate = new Date(dateNow.getTime() + AUTH_REQUEST_TTL);
  
  const queryString =
    `INSERT INTO auth_requests (uwo_email, created_at, expiry_at) VALUES ($1, $2, $3) RETURNING *`;
  const result = await dbPool.query<AuthRequestRow>(queryString, [
    email,
    dateNow,
    expiryDate,
  ]);

  if (!result.rowCount || result.rowCount === 0 || !result.rows[0]) {
    throw new Error("Could not create new auth request");
  }

  return mapAuthRequestRow(result.rows[0]);
}


export async function getAuthRequestsWithEmail(email: string) {
  if (!isUwoEmail(email)) {
    throw new Error("Attempting to search auth requests with a non-UWO email");
  }

  // TODO: Allow only a maximum of 2-3 auth requests at a time?
  const queryString =
    `SELECT * FROM auth_requests WHERE uwo_email = $1 LIMIT 5`;
  const result = await dbPool.query<AuthRequestRow>(queryString, [email]);
  if (!result.rowCount) return null; // TODO: Exception?
  if (result.rowCount === 0) return [];

  let authRequests: AuthRequest[] = [];
  for (let value of result.rows) {
    authRequests.push( mapAuthRequestRow(value) );
  }
  return authRequests;
}


export async function deleteAuthRequestById(id: string) {
  const queryString = 
    `DELETE FROM auth_requests WHERE id = $1`;
  const result = await dbPool.query(queryString, [id]);
  if (!result.rowCount || result.rowCount === 0) {
    return false;
  }
  if (result.rowCount > 1) {
    // TODO: Check if needed at all, should be impossible probably
    //       Also check if should be named error
    console.warn("Deleted more than 1 auth requests with same id");
  }
  return true;
}


export default {
  getAuthRequestById,
  createAuthRequest,
  getAuthRequestsWithEmail,
  deleteAuthRequestById,
};
