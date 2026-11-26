import { test, expect, onTestFinished } from "bun:test";
import {
  createAuthRequest,
  deleteAuthRequestById,
  getAuthRequestById,
  getAuthRequestsWithEmail,
  AuthRequestStatus,
  type AuthRequest
} from "../../src/models/authRequests";


const testEmail = "dummyemail@uwo.ca";
let createdRequestId: string | null = null;
let createdAuthRequest: AuthRequest | null = null;

test.serial("Create auth request", async () => {
  const authRequest = await createAuthRequest(testEmail);
  expect(authRequest.uwoEmail).toBe(testEmail);
  expect(authRequest.status).toBe(AuthRequestStatus.pending);
  const expiryAt = authRequest.expiryAt.getTime();
  const createdAt = authRequest.createdAt.getTime();
  const requestTtl = expiryAt - createdAt;
  expect(requestTtl).toBeGreaterThan(0);
  expect(authRequest.id).toBeString();
  expect(authRequest.id.length).toBeGreaterThan(0);
  createdRequestId = authRequest.id;
  createdAuthRequest = authRequest;
});


test.serial("Search for auth request with id",
  async () => {
    // if (typeof createdRequestId !== "string") {
    //   throw new Error(`createdRequestId is not a string`);
    // }

    if (createdAuthRequest === null) {
      throw new Error(`createdAuthRequest is null`);
    }

    const authRequest = await getAuthRequestById(createdAuthRequest.id);

    expect(authRequest).not.toBeNull();
    if (authRequest === null) {
      throw new Error("Auth request is null");
    }

    // TODO: Maybe use zod for verification?
    expect(authRequest).toEqual(createdAuthRequest);
  }
);


test.serial("Search for auth requests with email",
  async () => {
    if (createdAuthRequest === null) {
      throw new Error(`createdAuthRequest is null`);
    }

    const authRequests = await getAuthRequestsWithEmail(createdAuthRequest.uwoEmail);

    expect(authRequests).not.toBeNull();
    if (authRequests === null) {
      throw new Error("Auth request is null");
    }
    expect(authRequests).toBeArray();
    expect(authRequests.length).toBeGreaterThan(0)

    // TODO: Maybe use zod for verification?
    let retrievedAuthRequest = null;
    for (let authRequest of authRequests) {
      if (authRequest.id === createdAuthRequest.id) {
        retrievedAuthRequest = authRequest;
        break;
      }
    }
    expect(retrievedAuthRequest).not.toBeNull();
    expect(retrievedAuthRequest).toEqual(createdAuthRequest);
  }
);


test.serial("Delete auth request", async () => {
  if (createdAuthRequest === null) {
    throw new Error(`createdAuthRequest is null`);
  }
  const result = await deleteAuthRequestById(createdAuthRequest.id);
  expect(result).toBeTrue();
});

test.serial("Search by id after deletion", 
  async () => {
    if (createdAuthRequest === null) {
      throw new Error(`createdAuthRequest is null`);
    }

    const authRequest = await getAuthRequestById(createdAuthRequest.id);

    expect(authRequest).toBeNull();
  }
);
