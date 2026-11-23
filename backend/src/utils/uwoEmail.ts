import * as z from "zod";

const emailSchema = z.email();

type uwoEmail = string;

// TODO: Delete?
const isEmail = (value: string): boolean => {
  return false;
};

// TODO: Implement
export function normalizeEmail(value: string): uwoEmail | null {
  if (isUwoEmail(value)) {
    return "null";
  }
  return null;
}

// TODO: Implement
export function isUwoEmail(value: unknown): value is uwoEmail {
  return typeof value === "string";
}
