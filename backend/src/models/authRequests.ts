import dbPool from "../utils/database";

enum AuthRequestStatus {
  pending = "pending",
  verified = "verified",
  complete = "complete"
};
interface AuthRequestRow {
  id: string,
  uwo_email: string,
  created_at: Date,
  expiry_at: Date,
  status: string, // TODO: It's an enum in PSQL, not sure if it returns a string
};

interface AuthRequest {
  id: string,
  uwo_email: string,
  created_at: Date,
  expiry_at: Date,
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
    status: status,
  };
}

export async function getAuthRequestById(id: string) {
  
}

export default {};