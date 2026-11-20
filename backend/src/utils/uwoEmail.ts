import * as z from "zod";

const emailSchema = z.email();

type uwoEmail = string;

const isEmail = (value: string): boolean => {
  return false;
};

export function normalizeEmail(value: string): uwoEmail | null {
  if (isUwoEmail(value)) {
    return "null";
  }
  return null;
}

export function isUwoEmail(value: unknown): value is uwoEmail {
  return typeof value === "string";
}
